import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { activeAttendanceBySlot, addDay, canUploadRoster, combineDateTime, downloadText, effectiveDeployment, fmtAUD, fmtDateTime, fmtDelta, fmtTime, guessMapping, hoursBetween, isoToZoned, matchesRosterView, originalSlotCost, pendingVariationSlotIds, ROSTER_FIELDS, rosterCostTotals, rosterToCsv, slotCost, slotPaidHours, slotStatus, SOON_HOURS, staffingMetrics, zonedToIso, type RosterFieldKey, type RosterView, type Slot } from "@/lib/roster";
import { errMsg, useOps } from "./OpsContext";
import { BlurredAmount, CostsToggle, Drawer, Field, Page, Panel, Pill, Row, Table, Tabs, useFlash } from "./ui";

type Tab = "current" | "import" | "versions";

export function RosterPage() {
  const [tab, setTab] = useState<Tab>("current");
  const { roles, viewMode } = useOps();
  // Only a Super Admin may upload a roster (the database enforces the same rule).
  const canUpload = canUploadRoster(roles) && viewMode === "admin";
  return (
    <Page>
      <Tabs tabs={[{ id: "current", label: "Current approved roster" }, ...(canUpload ? [{ id: "import" as Tab, label: "Upload roster" }] : []), { id: "versions", label: "Versions & downloads" }]} value={tab} onChange={setTab} />
      {tab === "current" && <CurrentRoster onUpload={canUpload ? () => setTab("import") : undefined} />}
      {tab === "import" && canUpload && <ImportRoster onDone={() => setTab("current")} />}
      {tab === "versions" && <Versions />}
    </Page>
  );
}

function useScopedSlots() {
  const { slots, isManager, myContractorIds } = useOps();
  return useMemo(() => (isManager ? slots : slots.filter((s) => s.contractor_id && myContractorIds.includes(s.contractor_id))), [slots, isManager, myContractorIds]);
}

const VIEWS: { id: RosterView; label: string }[] = [
  { id: "all", label: "All shifts" },
  { id: "live", label: "Live now" },
  { id: "vacant", label: "Vacant now" },
  { id: "soon", label: `Starting in ${SOON_HOURS}h` },
  { id: "ending", label: `Finishing in ${SOON_HOURS}h` },
  { id: "pending", label: "Change pending" },
  { id: "changed", label: "Changed" },
  { id: "finished", label: "Finished" },
];
type GroupBy = "none" | "zone" | "time" | "contractor" | "role";
const GROUP_LABEL: Record<GroupBy, string> = { none: "No grouping", zone: "Group by zone", time: "Group by start time", contractor: "Group by contractor", role: "Group by role" };
const ROW_CAP = 500;

function CurrentRoster({ onUpload }: { onUpload?: () => void }) {
  const { event, contractors, contractorName, attendance, now, showCosts, slotCosts, guardName, variations, can } = useOps();
  const slots = useScopedSlots();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [contractor, setContractor] = useState("");
  const [costsOpen, setCostsOpen] = useState(false);
  const costCols = showCosts && costsOpen;
  const [zone, setZone] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [day, setDay] = useState("");
  const [view, setView] = useState<RosterView>(() => (VIEWS.find((v) => v.id === params.get("view"))?.id ?? "all"));
  const [groupBy, setGroupBy] = useState<GroupBy>("zone");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Links from the Sign-in desk and Variations open a shift with ?shift=<id>.
  const [openId, setOpenId] = useState<string | null>(() => params.get("shift"));
  useEffect(() => {
    if (params.has("shift") || params.has("view")) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const open = openId ? slots.find((s) => s.id === openId) ?? null : null;
  const tz = event?.timezone ?? "Australia/Sydney";
  const bySlot = useMemo(() => activeAttendanceBySlot(attendance), [attendance]);
  const metrics = staffingMetrics(slots, attendance, now);
  const pending = useMemo(() => pendingVariationSlotIds(variations), [variations]);
  const dayOf = (s: Slot) => isoToZoned(s.current_start, tz).slice(0, 10);
  const options = useMemo(() => {
    const z = new Set<string>(), r = new Set<string>(), d = new Set<string>();
    for (const s of slots) { const e = effectiveDeployment(s, now); if (e.zone) z.add(e.zone); if (e.role) r.add(e.role); d.add(dayOf(s)); }
    const sort = (x: Set<string>) => [...x].sort((a, b) => a.localeCompare(b));
    return { zones: sort(z), roles: sort(r), days: sort(d) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, tz]);
  const needle = q.trim().toLowerCase();
  const filtered = slots.filter((s) => {
    if (contractor && s.contractor_id !== contractor) return false;
    const e = effectiveDeployment(s, now);
    if (zone && e.zone !== zone) return false;
    if (role && e.role !== role) return false;
    if (day && dayOf(s) !== day) return false;
    if (status && slotStatus(s, bySlot, now) !== status) return false;
    if (needle) {
      const a = bySlot.get(s.id);
      const hay = `${s.shift_ref} ${e.position} ${e.zone} ${e.role} ${a ? guardName(a.guard_id) : ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  const viewCounts = Object.fromEntries(VIEWS.map((v) => [v.id, filtered.filter((s) => matchesRosterView(v.id, s, bySlot, now, pending)).length])) as Record<RosterView, number>;
  const rows = filtered.filter((s) => matchesRosterView(view, s, bySlot, now, pending))
    .sort((a, b) => (view === "finished" ? b.current_start.localeCompare(a.current_start) : a.current_start.localeCompare(b.current_start)) || a.shift_ref.localeCompare(b.shift_ref));
  const active = [q, contractor, zone, role, status, day].filter(Boolean).length;
  const clear = () => { setQ(""); setContractor(""); setZone(""); setRole(""); setStatus(""); setDay(""); };
  const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  const totals = useMemo(() => (showCosts ? rosterCostTotals(rows, slotCosts) : null), [showCosts, rows, slotCosts]);

  // Visual grouping: keep row order inside each group; time groups run in order, others A–Z.
  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "", label: "", items: rows }];
    const map = new Map<string, Slot[]>();
    for (const s of rows) {
      const e = effectiveDeployment(s, now);
      const k = groupBy === "zone" ? e.zone || "No zone" : groupBy === "role" ? e.role || "No role" : groupBy === "contractor" ? contractorName(s.contractor_id) : isoToZoned(s.current_start, tz).slice(0, 13);
      const list = map.get(k);
      if (list) list.push(s); else map.set(k, [s]);
    }
    const keys = [...map.keys()];
    if (groupBy === "time") { if (view === "finished") keys.reverse(); } else keys.sort((a, b) => a.localeCompare(b));
    return keys.map((k) => ({ key: k, label: groupBy === "time" ? `${fmtDay(k.slice(0, 10))} · starting ${k.slice(11, 13)}:00` : k, items: map.get(k)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, groupBy, tz, view]);
  const toggleGroup = (k: string) => setCollapsed((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const allCollapsed = groups.length > 1 && groups.every((g) => collapsed.has(g.key));

  const download = () => event && downloadText(`${event.name} - current approved roster.csv`, rosterToCsv(rows, contractorName, tz, now, showCosts ? slotCosts : undefined));
  const head = ["Shift ID", "Time", "Hours", "Role", "Position", "Zone", "Contractor", ...(costCols ? ["Rate", "Cost"] : []), "Status / on post"];
  const canDeploy = can("view_sign_in");
  const t = now.getTime();
  let shown = 0;

  const stat = (label: string, value: number, to: RosterView, tone?: string) => (
    <button onClick={() => setView(to)} className={cn("panel p-6 text-left transition-colors hover:border-primary", view === to && "border-primary")}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-5xl font-bold tabular-nums", tone)}>{value}</p>
    </button>
  );

  return (
    <>
    {/* Same numbers as the dashboard (all shifts on now, ignoring the filters below). */}
    <div className="grid gap-4 md:grid-cols-3">
      {stat("Guards rostered", metrics.rostered, "live")}
      {stat("Guards signed on", metrics.signedOn, "live", "text-success")}
      {stat("Missing guards", metrics.missing, "vacant", metrics.missing ? "text-danger" : undefined)}
    </div>
    <Panel title={`Current approved roster · ${rows.length} of ${slots.length} positions`} description={`All times in ${tz}. Click a row for details, sign-on and variations.`} actions={
      <>
        {onUpload && <button className="primary-button h-10" onClick={onUpload}>Upload roster (.xlsx / .csv)</button>}
        <button className="secondary-button h-10" onClick={download}>Download CSV</button>
      </>
    }>
      <div className="mb-3">
        <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} className={cn("whitespace-nowrap rounded px-3 py-2 text-sm font-semibold transition-colors", view === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {v.label}
              <span className={cn("ml-2 rounded px-1.5 text-xs tabular-nums", view === v.id ? "bg-primary-foreground/20" : v.id === "vacant" && viewCounts.vacant > 0 ? "bg-danger/15 text-danger" : v.id === "pending" && viewCounts.pending > 0 ? "bg-warning/15 text-warning" : "bg-secondary")}>{viewCounts[v.id]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="control-input h-10 w-64" placeholder="Search shift ID, position, zone, role, guard…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="control-input h-10 w-auto" value={day} onChange={(e) => setDay(e.target.value)}>
          <option value="">All days</option>{options.days.map((d) => <option key={d} value={d}>{fmtDay(d)}</option>)}
        </select>
        <select className="control-input h-10 w-auto" value={zone} onChange={(e) => setZone(e.target.value)}>
          <option value="">All zones</option>{options.zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <select className="control-input h-10 w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>{options.roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="control-input h-10 w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>{["Upcoming", "Filled", "Missing", "Completed"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="control-input h-10 w-auto" value={contractor} onChange={(e) => setContractor(e.target.value)}>
          <option value="">All contractors</option>{contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {active > 0 && <button className="secondary-button h-10" onClick={clear}>Clear filters ({active})</button>}
        <div className="ml-auto flex gap-2">
          <select className="control-input h-10 w-auto" value={groupBy} onChange={(e) => { setGroupBy(e.target.value as GroupBy); setCollapsed(new Set()); }} aria-label="Group rows">
            {(Object.keys(GROUP_LABEL) as GroupBy[]).map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
          </select>
          {groups.length > 1 && <button className="secondary-button h-10" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(groups.map((g) => g.key)))}>{allCollapsed ? "Expand all" : "Collapse all"}</button>}
        </div>
      </div>
      {totals && (
        <div className="mb-4 rounded-md border border-border">
          <CostsToggle open={costsOpen} onToggle={() => setCostsOpen((o) => !o)} />
          {costsOpen && (
            <div className="border-t border-border p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <CostTile label="Original roster cost" value={fmtAUD(totals.original)} />
                <CostTile label="Current approved cost" value={fmtAUD(totals.current)} />
                <CostTile label="Change from original" value={fmtDelta(totals.variance)} tone={totals.variance > 0 ? "danger" : totals.variance < 0 ? "success" : undefined} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Hover over (or tap) an amount to reveal it. Rate and cost columns show in the table while this is open.</p>
            </div>
          )}
        </div>
      )}
      <Table head={head} empty={rows.length === 0}>
        {groups.map((g) => {
          const isCollapsed = collapsed.has(g.key);
          const st = g.items.map((s) => slotStatus(s, bySlot, now));
          const vacant = st.filter((x) => x === "Missing").length;
          const onPost = g.items.filter((s) => bySlot.has(s.id)).length;
          const pend = g.items.filter((s) => pending.has(s.id)).length;
          const body = isCollapsed ? [] : g.items.slice(0, Math.max(0, ROW_CAP - shown));
          shown += body.length;
          return (
            <Fragment key={g.key || "all"}>
              {groupBy !== "none" && (
                <tr className="cursor-pointer bg-secondary/70 hover:bg-secondary" onClick={() => toggleGroup(g.key)}>
                  <td colSpan={head.length} className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isCollapsed && "-rotate-90")} aria-hidden />
                      <span className="font-bold">{g.label}</span>
                      <span className="text-xs text-muted-foreground">{g.items.length} position{g.items.length === 1 ? "" : "s"}</span>
                      {vacant > 0 && <span className="rounded bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger">{vacant} vacant</span>}
                      {onPost > 0 && <span className="rounded bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">{onPost} on post</span>}
                      {pend > 0 && <span className="rounded bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">{pend} change pending</span>}
                    </div>
                  </td>
                </tr>
              )}
              {body.map((s) => {
                const d = effectiveDeployment(s, now);
                const changed = s.version > 1 || s.is_additional;
                const c = slotCosts.get(s.id);
                const a = bySlot.get(s.id);
                const sStatus = slotStatus(s, bySlot, now);
                const start = new Date(s.current_start).getTime();
                const needsGuard = canDeploy && !a && s.status === "active" && (sStatus === "Missing" || (start > t && start <= t + SOON_HOURS * 36e5));
                return (
                  <tr key={s.id} className="cursor-pointer hover:bg-secondary/40" onClick={() => setOpenId(s.id)}>
                    <td className="px-3 py-2 font-mono text-xs">{s.shift_ref}{changed && <span className="ml-1 text-primary" title="Changed by a variation">●</span>}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtDateTime(s.current_start, tz)}–{fmtTime(s.current_end, tz)}</td>
                    <td className="px-3 py-2 tabular-nums">{hoursBetween(s.current_start, s.current_end)}</td>
                    <td className="px-3 py-2">{d.role}</td>
                    <td className="px-3 py-2">{d.position}{d.temporary && <span className="ml-1 text-xs text-warning">(temp)</span>}</td>
                    <td className="px-3 py-2">{d.zone}</td>
                    <td className="px-3 py-2">{contractorName(s.contractor_id)}</td>
                    {costCols && <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>{c ? <BlurredAmount value={fmtAUD(c.hourly_rate)} /> : <span className="text-muted-foreground">—</span>}</td>}
                    {costCols && <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>{c ? <BlurredAmount value={fmtAUD(slotCost(s, c))} /> : <span className="text-muted-foreground">—</span>}</td>}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Pill status={sStatus} />
                        {pending.has(s.id) && <Pill status="returned" label="Change pending" />}
                        {needsGuard && <Link to={`/admin/sign-in?slot=${s.id}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap rounded bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground hover:brightness-110">Sign on →</Link>}
                      </div>
                      {a && <span className="mt-0.5 block text-xs text-muted-foreground">{guardName(a.guard_id)}</span>}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          );
        })}
      </Table>
      {shown >= ROW_CAP && rows.length > ROW_CAP && <p className="mt-2 text-xs text-muted-foreground">Showing the first {ROW_CAP} — use the tabs, search or collapse groups to narrow down. The CSV includes all rows.</p>}
      <SlotDrawer slot={open} onClose={() => setOpenId(null)} />
    </Panel>
    </>
  );
}

type LogRow = { id: string; change_type: string; summary: string; actor_name: string | null; created_at: string };

function SlotDrawer({ slot, onClose }: { slot: Slot | null; onClose: () => void }) {
  const { event, contractorName, reload, now, showCosts, slotCosts, attendance, variations, can, guardName } = useOps();
  const [log, setLog] = useState<LogRow[]>([]);
  const [tab, setTab] = useState<"details" | "history">("details");
  const [rate, setRate] = useState("");
  const [paid, setPaid] = useState("");
  const flash = useFlash();
  const tz = event?.timezone ?? "Australia/Sydney";
  const cost = slot ? slotCosts.get(slot.id) : undefined;

  useEffect(() => {
    if (!slot) return;
    setTab("details"); flash.clear();
    supabase.from("roster_change_log").select("id,change_type,summary,actor_name,created_at").eq("slot_id", slot.id).order("created_at").then(({ data }) => setLog((data ?? []) as LogRow[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot?.id]);

  useEffect(() => {
    setRate(cost ? String(cost.hourly_rate) : "");
    setPaid(cost?.paid_hours != null ? String(cost.paid_hours) : "");
  }, [cost?.hourly_rate, cost?.paid_hours, slot?.id]);

  if (!slot) return null;
  const d = effectiveDeployment(slot, now);
  const saveRate = async () => {
    const r = Number(rate);
    if (!rate || Number.isNaN(r) || r < 0) return flash.show("Enter a valid hourly rate.", true);
    const p = paid ? Number(paid) : null;
    if (p !== null && (Number.isNaN(p) || p < 0)) return flash.show("Enter valid paid hours.", true);
    const { error } = await supabase.from("roster_slot_costs").upsert({ slot_id: slot.id, event_id: slot.event_id, hourly_rate: r, paid_hours: p });
    if (error) flash.show(errMsg(error), true); else { flash.show("Rate saved."); reload(); }
  };

  const onPost = activeAttendanceBySlot(attendance).get(slot.id);
  const t = now.getTime();
  const finished = new Date(slot.current_end).getTime() <= t;
  const started = new Date(slot.current_start).getTime() <= t;
  const canDeploy = can("view_sign_in") && slot.status === "active" && !onPost && !finished;
  const canVary = can("request_variations");
  const slotVariations = can("view_variations") ? variations.filter((v) => v.slot_id === slot.id) : [];

  return (
    <Drawer open onClose={onClose} title={`${slot.shift_ref} · ${d.position}`}>
      {(canDeploy || canVary) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {canDeploy && <Link to={`/admin/sign-in?slot=${slot.id}`} className="primary-button h-11">Sign a guard on to this position</Link>}
          {canVary && <Link to={`/admin/variations?shift=${slot.id}`} className="secondary-button h-11">Request variation</Link>}
        </div>
      )}
      <div className={cn("mb-4 rounded-md border p-3 text-sm", onPost ? "border-success/40 bg-success/10" : started && !finished ? "border-danger/40 bg-danger/10" : "border-border bg-secondary/40")}>
        {onPost ? <>
          <p className="font-bold">On post: {guardName(onPost.guard_id)}</p>
          <p className="text-muted-foreground">Signed on {fmtTime(onPost.signed_on_at, tz)} · automatic sign-off {fmtTime(slot.current_end, tz)}</p>
        </> : finished ? <p className="text-muted-foreground">This shift has finished.</p>
          : started ? <p className="font-bold text-danger">Vacant — the shift has started and nobody is signed on.</p>
          : <p className="text-muted-foreground">Nobody signed on yet · starts {fmtDateTime(slot.current_start, tz)}</p>}
      </div>
      <Tabs tabs={[{ id: "details", label: "Details" }, { id: "history", label: "Change history", count: log.length }]} value={tab} onChange={setTab} />
      {tab === "details" ? (
        <div className="mt-4 space-y-5">
          {slotVariations.length > 0 && (
            <div>
              <h3 className="mb-1 font-semibold">Variations for this shift</h3>
              {slotVariations.map((v) => (
                <Link key={v.id} to={`/admin/variations?open=${v.id}`} className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0 hover:text-primary">
                  <span><span className="font-mono text-xs">{v.ref}</span> · {v.reason || "No reason given"}</span>
                  <Pill status={v.status} label={v.status === "awaiting_ack" ? "Awaiting ack" : undefined} />
                </Link>
              ))}
            </div>
          )}
          <div>
            <h3 className="mb-1 font-semibold">Current approved</h3>
            <Row label="Time" value={`${fmtDateTime(slot.current_start, tz)} – ${fmtDateTime(slot.current_end, tz)}`} />
            <Row label="Role" value={d.role} />
            <Row label="Position" value={d.position} />
            <Row label="Zone" value={d.zone} />
            {d.temporary && <Row label="Temporary until" value={fmtDateTime(d.until!, tz)} />}
            <Row label="Contractor" value={contractorName(slot.contractor_id)} />
            <Row label="Scope" value={slot.scope || "—"} />
            {slot.is_additional && <Row label="Classification" value="Additional approved scope" />}
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Original roster</h3>
            {slot.is_additional ? <p className="text-sm text-muted-foreground">Not in the original roster — added by an approved variation.</p> : <>
              <Row label="Time" value={slot.original_start ? `${fmtDateTime(slot.original_start, tz)} – ${fmtDateTime(slot.original_end!, tz)}` : "—"} />
              <Row label="Role" value={slot.original_role ?? "—"} />
              <Row label="Position" value={slot.original_position ?? "—"} />
              <Row label="Zone" value={slot.original_zone ?? "—"} />
            </>}
          </div>
          {showCosts && (
            <div className="space-y-2">
              <h3 className="font-semibold">Cost <span className="text-xs font-normal text-muted-foreground">(admins only)</span></h3>
              {cost ? <>
                <Row label="Hourly rate" value={fmtAUD(cost.hourly_rate)} />
                <Row label="Paid hours now" value={slotPaidHours(slot, cost)} />
                <Row label="Original cost" value={slot.is_additional ? "— (added by variation)" : fmtAUD(originalSlotCost(slot, cost))} />
                <Row label="Current approved cost" value={fmtAUD(slotCost(slot, cost))} />
              </> : <p className="text-sm text-muted-foreground">No rate set for this position.</p>}
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input className="control-input h-10" placeholder="Hourly rate" value={rate} onChange={(e) => setRate(e.target.value)} />
                <input className="control-input h-10" placeholder="Paid hours (optional)" value={paid} onChange={(e) => setPaid(e.target.value)} />
                <button className="secondary-button h-10" onClick={saveRate}>Save rate</button>
              </div>
              <p className="text-xs text-muted-foreground">Paid hours are the hours charged in the original roster. Leave blank to use the rostered shift length.</p>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Changing times, position or scope requires a variation.</p>
            {flash.node}
          </div>
        </div>
      ) : (
        <ol className="mt-4 space-y-4 border-l border-border pl-5">
          {!slot.is_additional && <TimelineItem title="Original roster" body={`${isoToZoned(slot.original_start ?? slot.current_start, tz).slice(11)}–${isoToZoned(slot.original_end ?? slot.current_end, tz).slice(11)}, ${slot.original_position}, ${slot.original_role}`} />}
          {log.map((l) => <TimelineItem key={l.id} title={l.summary} body={`${fmtDateTime(l.created_at, tz)} · ${l.actor_name ?? "System"}`} />)}
          <TimelineItem title="Current approved shift" body={`${fmtTime(slot.current_start, tz)}–${fmtTime(slot.current_end, tz)}, ${d.position} (${d.zone})`} strong />
        </ol>
      )}
    </Drawer>
  );
}

function TimelineItem({ title, body, strong }: { title: string; body: string; strong?: boolean }) {
  return (
    <li className="relative">
      <span className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ${strong ? "bg-primary" : "bg-muted-foreground"}`} />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </li>
  );
}

// ---------------- Import ----------------

const money = (s: string) => { const n = parseFloat(s.replace(/[$,\s]/g, "")); return Number.isFinite(n) ? n : null; };

function ImportRoster({ onDone }: { onDone: () => void }) {
  const { event, contractors, slots, reload, session, showCosts } = useOps();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<RosterFieldKey, string>>>({});
  const [busy, setBusy] = useState(false);
  const flash = useFlash();
  const [replace, setReplace] = useState(slots.length > 0);
  const tz = event?.timezone ?? "Australia/Sydney";
  const fields = ROSTER_FIELDS.filter((f) => showCosts || !f.cost);

  const onFile = async (file: File) => {
    flash.clear();
    // CSV: keep every value exactly as typed (no US-style date reformatting).
    // Excel: turn real date/time cells into unambiguous "YYYY-MM-DD" / "HH:mm" text.
    const isText = /\.(csv|txt)$/i.test(file.name);
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", raw: isText, cellDates: false, cellNF: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!isText) normaliseDateCells(ws);
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "", raw: false });
    const hs = Object.keys(data[0] ?? {});
    setFileName(file.name); setRows(data); setHeaders(hs); setMapping(guessMapping(hs));
  };

  const build = () => {
    const out: Array<Record<string, any>> = [];
    const errors: string[] = [];
    rows.forEach((r, i) => {
      const get = (k: RosterFieldKey) => (mapping[k] ? String(r[mapping[k]!] ?? "").trim() : "");
      try {
        const ref = get("shift_ref");
        if (!ref) throw new Error("missing Shift ID");
        const startLocal = combineDateTime(get("date"), get("start"));
        let endLocal = combineDateTime(get("date"), get("finish"));
        if (endLocal <= startLocal) endLocal = addDay(endLocal);
        const count = Math.max(1, parseInt(get("count") || "1", 10) || 1);
        let rate = showCosts ? money(get("hourly_rate")) : null;
        let paid = showCosts ? money(get("paid_hours")) : null;
        const total = showCosts ? money(get("total_cost")) : null;
        if (rate == null && total != null && paid) rate = total / count / paid;
        if (paid == null && total != null && rate) paid = total / count / rate;
        for (let n = 1; n <= count; n++) {
          out.push({
            shift_ref: count > 1 ? `${ref}-${n}` : ref,
            contractor: get("contractor"),
            role: get("role"), position: get("position"), zone: get("zone"), scope: get("scope"), notes: get("notes") || null,
            current_start: zonedToIso(startLocal, tz), current_end: zonedToIso(endLocal, tz),
            _rate: rate, _paid: paid,
          });
        }
      } catch (e) { errors.push(`Row ${i + 2}: ${errMsg(e)}`); }
    });
    return { out, errors };
  };

  const preview = rows.length ? build() : { out: [], errors: [] };
  const existingRefs = new Set(slots.map((s) => s.shift_ref));
  const newCount = preview.out.filter((r) => !existingRefs.has(r.shift_ref)).length;
  const missingRequired = ROSTER_FIELDS.filter((f) => f.required && !mapping[f.key]);
  const rowCost = (r: Record<string, any>) => (r._rate == null ? null : (r._paid ?? hoursBetween(r.current_start, r.current_end)) * r._rate);
  const fileCost = showCosts ? preview.out.reduce((t, r) => t + (rowCost(r) ?? 0), 0) : 0;
  const pricedRows = preview.out.filter((r) => r._rate != null).length;

  const runImport = async () => {
    if (!event) return;
    if (replace && slots.length > 0 && !window.confirm(`This deletes all ${slots.length} current positions, their variations and change history for "${event.name}", and makes this file the new Original Roster – Version 1. Continue?`)) return;
    setBusy(true);
    try {
      if (replace && slots.length > 0) {
        const { error } = await supabase.rpc("reset_event_roster" as any, { _event_id: event.id });
        if (error) throw error;
      }
      const known = replace ? new Set<string>() : existingRefs;
      const contractorIds = new Map(contractors.map((c) => [c.name.toLowerCase(), c.id]));
      for (const name of new Set(preview.out.map((r) => r.contractor).filter(Boolean))) {
        if (!contractorIds.has(name.toLowerCase())) {
          const { data, error } = await supabase.from("contractors").insert({ name }).select("id").single();
          if (error) throw error;
          contractorIds.set(name.toLowerCase(), data.id);
        }
      }
      const isFirst = replace || slots.length === 0;
      const freshRows = preview.out.filter((r) => !known.has(r.shift_ref));
      const priceByRef = new Map(freshRows.filter((r) => r._rate != null).map((r) => [r.shift_ref as string, { rate: r._rate as number, paid: r._paid as number | null }]));
      const fresh = freshRows.map(({ contractor, _rate, _paid, ...r }) => ({ ...r, event_id: event.id, contractor_id: contractor ? contractorIds.get(contractor.toLowerCase()) ?? null : null }));
      for (let i = 0; i < fresh.length; i += 500) {
        const { data, error } = await supabase.from("roster_slots").insert(fresh.slice(i, i + 500) as any).select("id,shift_ref");
        if (error) throw error;
        const costRows = (data ?? []).filter((s) => priceByRef.has(s.shift_ref)).map((s) => {
          const p = priceByRef.get(s.shift_ref)!;
          return { slot_id: s.id, event_id: event.id, hourly_rate: Math.round(p.rate * 10000) / 10000, paid_hours: p.paid == null ? null : Math.round(p.paid * 10000) / 10000 };
        });
        if (showCosts && costRows.length) {
          const { error: ce } = await supabase.from("roster_slot_costs").insert(costRows);
          if (ce) throw ce;
        }
      }
      const { data: vers } = await supabase.from("roster_versions").select("version").eq("event_id", event.id).order("version", { ascending: false }).limit(1);
      const next = isFirst ? 1 : (vers?.[0]?.version ?? 0) + 1;
      await supabase.from("roster_versions").insert({
        event_id: event.id, version: next, kind: isFirst ? "original" : "import",
        label: isFirst ? "Original Roster – Version 1" : `Revised upload v${next} (${fresh.length} new positions)`,
        source_file_name: fileName, slot_count: (isFirst ? 0 : slots.length) + fresh.length, created_by: session?.user.id,
      });
      const skipped = preview.out.length - fresh.length;
      flash.show(isFirst ? `Roster set: ${fresh.length} positions are now the current approved roster.` : `Imported ${fresh.length} new positions.${skipped ? ` ${skipped} existing shifts recognised and left unchanged — use a variation to change them.` : ""}`);
      setRows([]); await reload(); window.setTimeout(onDone, 1200);
    } catch (e) { flash.show(errMsg(e), true); }
    setBusy(false);
  };

  return (
    <Panel title="Import roster" description={`Upload a CSV or Excel roster. Times are read in the event's time zone (${tz}). Finish times earlier than the start are treated as next day.`}>
      <input type="file" accept=".csv,.xlsx,.xls" className="control-input h-12 pt-2.5" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {headers.length > 0 && (
        <div className="mt-5 space-y-5">
          <div>
            <h3 className="mb-2 font-semibold">Match your columns</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((f) => (
                <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`}>
                  <select className="control-input h-10" value={mapping[f.key] ?? ""} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}>
                    <option value="">— not in file —</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </Field>
              ))}
            </div>
          </div>
          {missingRequired.length > 0 ? <p className="text-sm text-danger">Please match: {missingRequired.map((f) => f.label).join(", ")}</p> : (
            <>
              {slots.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className={`cursor-pointer rounded-md border p-3 text-sm ${replace ? "border-primary bg-primary/10" : "border-border"}`}>
                    <input type="radio" className="mr-2" checked={replace} onChange={() => setReplace(true)} />
                    <b>Replace roster & set as baseline</b>
                    <p className="mt-1 text-xs text-muted-foreground">Removes all {slots.length} current positions (including sample data) and their variations. This file becomes Original Roster – Version 1.</p>
                  </label>
                  <label className={`cursor-pointer rounded-md border p-3 text-sm ${!replace ? "border-primary bg-primary/10" : "border-border"}`}>
                    <input type="radio" className="mr-2" checked={!replace} onChange={() => setReplace(false)} />
                    <b>Revise – match by Shift ID</b>
                    <p className="mt-1 text-xs text-muted-foreground">Adds new shifts only. Existing Shift IDs are kept; change them through a variation.</p>
                  </label>
                </div>
              )}
              <p className="text-sm">{rows.length} rows → <b>{preview.out.length}</b> positions{!replace && <> · <b>{newCount}</b> new · {preview.out.length - newCount} already in roster</>}{showCosts && pricedRows > 0 && <> · total cost <b>{fmtAUD(fileCost)}</b> ({pricedRows} priced)</>}</p>
              {preview.errors.length > 0 && <div className="max-h-32 overflow-y-auto rounded-md bg-danger/10 p-3 text-xs text-danger">{preview.errors.slice(0, 30).map((e) => <p key={e}>{e}</p>)}</div>}
              <Table head={["Shift ID", "Start", "Finish", "Position", "Zone", "Contractor", ...(showCosts ? ["Rate", "Cost"] : [])]}>
                {preview.out.slice(0, 8).map((r) => <tr key={r.shift_ref}><td className="px-3 py-2">{r.shift_ref}</td><td className="px-3 py-2">{isoToZoned(r.current_start, tz)}</td><td className="px-3 py-2">{isoToZoned(r.current_end, tz)}</td><td className="px-3 py-2">{r.position}</td><td className="px-3 py-2">{r.zone}</td><td className="px-3 py-2">{r.contractor}</td>{showCosts && <td className="px-3 py-2 tabular-nums">{fmtAUD(r._rate)}</td>}{showCosts && <td className="px-3 py-2 tabular-nums">{fmtAUD(rowCost(r))}</td>}</tr>)}
              </Table>
              <button className="primary-button h-12" disabled={busy || (replace ? preview.out.length === 0 : newCount === 0)} onClick={runImport}>{busy ? "Importing…" : replace ? `Replace roster with ${preview.out.length} positions` : `Import ${newCount} positions`}</button>
            </>
          )}
        </div>
      )}
      <div className="mt-4">{flash.node}</div>
    </Panel>
  );
}

// ---------------- Versions ----------------

type Version = { id: string; version: number; kind: string; label: string; source_file_name: string | null; slot_count: number; created_at: string };

function Versions() {
  const { event, contractorName, now, showCosts, slotCosts } = useOps();
  const slots = useScopedSlots();
  const [versions, setVersions] = useState<Version[]>([]);
  const tz = event?.timezone ?? "Australia/Sydney";
  const costs = showCosts ? slotCosts : undefined;
  useEffect(() => {
    if (!event) return;
    supabase.from("roster_versions").select("*").eq("event_id", event.id).order("version", { ascending: false }).then(({ data }) => setVersions((data ?? []) as Version[]));
  }, [event, slots.length]);

  const originalCsv = () => {
    const orig = slots.filter((s) => !s.is_additional).map((s) => ({ ...s, current_start: s.original_start ?? s.current_start, current_end: s.original_end ?? s.current_end, role: s.original_role ?? s.role, position: s.original_position ?? s.position, zone: s.original_zone ?? s.zone, temp_redeploy: null, version: 1 }));
    downloadText(`${event!.name} - original roster v1.csv`, rosterToCsv(orig, contractorName, tz, now, costs));
  };

  return (
    <Panel title="Roster versions" description="The original roster is kept permanently as the contractual baseline." actions={
      <>
        <button className="secondary-button h-10" onClick={originalCsv}>Download original (v1)</button>
        <button className="primary-button h-10" onClick={() => downloadText(`${event!.name} - current approved roster.csv`, rosterToCsv(slots, contractorName, tz, now, costs))}>Download current approved</button>
      </>
    }>
      <Table head={["Version", "Type", "Description", "Positions", "Created"]} empty={versions.length === 0}>
        {versions.map((v) => (
          <tr key={v.id}>
            <td className="px-3 py-2 font-bold">v{v.version}</td>
            <td className="px-3 py-2"><Pill status={v.kind} label={v.kind === "original" ? "Original" : v.kind === "import" ? "Upload" : "Approved change"} /></td>
            <td className="px-3 py-2">{v.label}{v.source_file_name && <span className="text-muted-foreground"> · {v.source_file_name}</span>}</td>
            <td className="px-3 py-2 tabular-nums">{v.slot_count}</td>
            <td className="px-3 py-2">{fmtDateTime(v.created_at, tz)}</td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}

function CostTile({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <BlurredAmount value={value} className={`mt-1 text-2xl font-bold ${tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : ""}`} />
    </div>
  );
}

/** Replace Excel date/time cells with plain text so they can't be read in US month/day order. */
function normaliseDateCells(ws: XLSX.WorkSheet) {
  const pad = (n: number) => String(n).padStart(2, "0");
  for (const key of Object.keys(ws)) {
    if (key.startsWith("!")) continue;
    const cell = ws[key] as XLSX.CellObject;
    if (cell.t !== "n" || typeof cell.v !== "number" || !cell.z || !XLSX.SSF.is_date(cell.z as string)) continue;
    const p = XLSX.SSF.parse_date_code(cell.v);
    const time = `${pad(p.H)}:${pad(p.M)}`;
    const date = `${p.y}-${pad(p.m)}-${pad(p.d)}`;
    const text = cell.v < 1 ? time : Number.isInteger(cell.v) ? date : `${date} ${time}`;
    ws[key] = { t: "s", v: text, w: text };
  }
}
