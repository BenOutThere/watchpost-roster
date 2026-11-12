import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Download, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadText, fmtAUD, fmtDateTime, fmtDelta, fmtTime, groupVariations, hoursBetween, isoToZoned, requestKey, requestStatus, variationsToCsv, slotCost, suggestedRate, timeChangeDelta, zonedToIso, type Slot } from "@/lib/roster";
import { errMsg, useOps, type Variation } from "./OpsContext";
import { Drawer, Field, Page, Panel, Pill, Row, Table, Tabs, statusLabel, useFlash } from "./ui";

type VType = "time" | "redeploy" | "additional";
const typeLabel: Record<VType, string> = { time: "Extend / reduce shift", redeploy: "Change scope / redeploy", additional: "Add guards / shifts" };
const PENDING = ["awaiting_ack", "requested", "awaiting_approval", "returned"];

export function VariationsPage() {
  const { variations, can } = useOps();
  const canRequest = can("request_variations");
  const pending = groupVariations(variations).filter((g) => ["awaiting_ack", "awaiting_approval"].includes(requestStatus(g.map((v) => v.status)))).length;
  // Links from the Roster: ?shift=<id> starts a request for that shift, ?open=<variation id> opens it in the register.
  const [params, setParams] = useSearchParams();
  const [init] = useState(() => ({ shift: params.get("shift"), open: params.get("open"), status: params.get("status") }));
  useEffect(() => {
    if (init.shift || init.open || init.status) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [tab, setTab] = useState<"register" | "new">(init.shift && canRequest ? "new" : "register");
  return (
    <Page>
      <Tabs tabs={[...(canRequest ? [{ id: "new" as const, label: "New request" }] : []), { id: "register" as const, label: "Variation register", count: pending }]} value={tab} onChange={setTab} />
      {tab === "new" && canRequest ? <NewVariation initialSlotId={init.shift} onDone={() => setTab("register")} /> : <Register initialOpenId={init.open} initialStatus={init.status} />}
    </Page>
  );
}

function slotLabel(s: Slot, tz: string) {
  return `${s.shift_ref} · ${s.position} · ${s.zone} · ${fmtTime(s.current_start, tz)}–${fmtTime(s.current_end, tz)}`;
}

/** One-line description of a variation's original or proposed values. */
function describe(type: VType, d: Record<string, any>, tz: string) {
  if (!d || !Object.keys(d).length) return "—";
  if (type === "time") return `${d.start ? fmtDateTime(d.start, tz) : "—"}–${d.end ? fmtTime(d.end, tz) : "—"}${d.hours != null ? ` (${d.hours} h)` : ""}`;
  if (type === "redeploy") return `${[d.role, d.position, d.zone].filter(Boolean).join(" · ")}${d.until ? ` until ${fmtTime(d.until, tz)}` : ""}`;
  return `${d.count ?? ""} × ${d.position ?? ""} ${d.start ? fmtTime(d.start, tz) : ""}–${d.end ? fmtTime(d.end, tz) : ""}`;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const SHOW_MAX = 200;

type Req = { slot_id: string | null; contractor_id: string | null; original: Record<string, any>; proposed: Record<string, any> };

function NewVariation({ onDone, initialSlotId }: { onDone: () => void; initialSlotId?: string | null }) {
  const { event, slots, contractors, isManager, myContractorIds, session, reload, contractorName, showCosts, slotCosts } = useOps();
  const tz = event?.timezone ?? "Australia/Sydney";
  const [step, setStep] = useState(1);
  const [type, setType] = useState<VType>("time");
  const [slotIds, setSlotIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const [per, setPer] = useState<Record<string, Record<string, string>>>({});
  const flash = useFlash();
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Completed shifts can be varied too; they still need contractor acknowledgement and approval like any other request.
  const scoped = useMemo(() => slots.filter((s) => isManager || (s.contractor_id && myContractorIds.includes(s.contractor_id))), [slots, isManager, myContractorIds]);
  const allMatches = useMemo(() => {
    const t = Date.now();
    const list = scoped.filter((s) => !search || `${slotLabel(s, tz)} ${new Date(s.current_end).getTime() <= t ? "finished completed" : ""}`.toLowerCase().includes(search.toLowerCase()));
    // Live and upcoming shifts first; finished shifts after them, most recent first.
    const live = list.filter((s) => new Date(s.current_end).getTime() > t);
    const done = list.filter((s) => new Date(s.current_end).getTime() <= t).reverse();
    return [...live, ...done];
  }, [scoped, search, tz]);
  const isDone = (s: Slot) => new Date(s.current_end).getTime() <= Date.now();
  const matches = allMatches.slice(0, SHOW_MAX);
  const selected = useMemo(() => slotIds.map((id) => slots.find((s) => s.id === id)).filter(Boolean) as Slot[], [slotIds, slots]);
  const slot = selected[0];
  const multi = selected.length > 1;
  const vacantTargets = scoped.filter((s) => !slotIds.includes(s.id) && !s.assigned_guard_id);
  const allowedContractors = isManager ? contractors : contractors.filter((c) => myContractorIds.includes(c.id));
  const rmode = multi ? "change" : f.mode ?? "change";

  const prefill = (id: string) => {
    const s = slots.find((x) => x.id === id);
    if (s) setF((p) => ({ ...p, start: isoToZoned(s.current_start, tz), end: isoToZoned(s.current_end, tz), from: isoToZoned(new Date().toISOString(), tz) }));
  };
  const toggle = (id: string) => {
    if (slotIds.includes(id)) { setSlotIds((p) => p.filter((x) => x !== id)); return; }
    if (!slotIds.length) prefill(id);
    setSlotIds((p) => [...p, id]);
  };
  // Opened from a roster shift: tick it straight away.
  useEffect(() => {
    if (initialSlotId && !slotIds.length && slots.some((s) => s.id === initialSlotId)) { prefill(initialSlotId); setSlotIds([initialSlotId]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSlotId, slots.length]);
  const selectAllShown = () => {
    const add = matches.filter((s) => !slotIds.includes(s.id)).map((s) => s.id);
    if (!slotIds.length && add[0]) prefill(add[0]);
    setSlotIds((p) => [...p, ...add]);
  };

  const iso = (k: string) => (f[k] ? zonedToIso(f[k], tz) : null);

  /** Per-shift value typed by the user, defaulting to the shift's current value. */
  const pv = (s: Slot, k: "start" | "end" | "role" | "position" | "zone") =>
    per[s.id]?.[k] ?? (k === "start" ? isoToZoned(s.current_start, tz) : k === "end" ? isoToZoned(s.current_end, tz) : s[k]);
  const setPv = (id: string, k: string, v: string) => setPer((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));

  /** New times for one shift, entered separately for each shift. */
  const timesFor = (s: Slot): { start: string; end: string } | null => {
    try { return { start: zonedToIso(pv(s, "start"), tz), end: zonedToIso(pv(s, "end"), tz) }; } catch { return null; }
  };

  const build = (): Req[] => {
    if (!f.reason?.trim()) throw new Error("Please give a reason for the change.");
    if (type === "time") {
      if (!selected.length) throw new Error("Select at least one shift.");
      return selected.map((s) => {
        const t = timesFor(s);
        if (!t) throw new Error(`${s.shift_ref}: enter a valid start and finish (YYYY-MM-DD HH:mm).`);
        if (new Date(t.end) <= new Date(t.start)) throw new Error(`${s.shift_ref}: finish must be after start.`);
        if (new Date(t.start).getTime() === new Date(s.current_start).getTime() && new Date(t.end).getTime() === new Date(s.current_end).getTime())
          throw new Error(`${s.shift_ref}: the times haven't been changed. Change them or untick this shift.`);
        return { slot_id: s.id, contractor_id: s.contractor_id, original: { start: s.current_start, end: s.current_end, hours: hoursBetween(s.current_start, s.current_end) }, proposed: { start: t.start, end: t.end, hours: hoursBetween(t.start, t.end) } };
      });
    }
    if (type === "redeploy") {
      if (!selected.length) throw new Error("Select at least one shift.");
      if (rmode === "move") {
        const t = slots.find((s) => s.id === f.target);
        if (!t) throw new Error("Choose the vacant position to move the guard to.");
        return [{ slot_id: slot.id, contractor_id: slot.contractor_id, original: { role: slot.role, position: slot.position, zone: slot.zone }, proposed: { target_slot_id: t.id, role: t.role, position: t.position, zone: t.zone } }];
      }
      const from = iso("from"), until = f.temporary === "yes" ? iso("until") : null;
      return selected.map((s) => {
        const role = pv(s, "role").trim(), position = pv(s, "position").trim(), zone = pv(s, "zone").trim();
        if (!role || !position || !zone) throw new Error(`${s.shift_ref}: role, position and zone can't be blank.`);
        if (role === s.role && position === s.position && zone === s.zone) throw new Error(`${s.shift_ref}: nothing has been changed. Change it or untick this shift.`);
        return { slot_id: s.id, contractor_id: s.contractor_id, original: { role: s.role, position: s.position, zone: s.zone }, proposed: { role, position, zone, from, until } };
      });
    }
    const count = parseInt(f.count || "0", 10);
    if (!count || count < 1) throw new Error("How many additional guards?");
    if (!f.contractor) throw new Error("Select a contractor.");
    const start = iso("start"), end = iso("end");
    if (!start || !end || new Date(end) <= new Date(start)) throw new Error("Enter a valid start and finish.");
    return [{ slot_id: null, contractor_id: f.contractor, original: {}, proposed: { count, start, end, role: f.role ?? "", position: f.position ?? "", zone: f.zone ?? "", hours: hoursBetween(start, end) * count } }];
  };

  let review: Req[] | null = null; let reviewError = "";
  if (step === 3) { try { review = build(); } catch (e) { reviewError = errMsg(e); } }

  // Cost estimate (admins only). The database prices every shift in the request the same way when it is submitted.
  const suggested = suggestedRate(slots, slotCosts, f.role ?? "");
  const addRate = f.rate ? Number(f.rate) : suggested;
  const estimate = (() => {
    if (!showCosts) return null;
    if (type === "additional") {
      const count = parseInt(f.count || "0", 10);
      try {
        const h = f.start && f.end ? hoursBetween(zonedToIso(f.start, tz), zonedToIso(f.end, tz)) : 0;
        return count > 0 && h > 0 ? { rate: addRate as number | null, mixed: false, missing: 0, original: 0, proposed: r2(count * h * addRate), delta: r2(count * h * addRate) } : null;
      } catch { return null; }
    }
    if (!selected.length) return null;
    let original = 0, delta = 0, missing = 0, mixed = false;
    let rate: number | null = null;
    for (const s of selected) {
      const c = slotCosts.get(s.id);
      if (!c) { missing++; continue; }
      original += slotCost(s, c) ?? 0;
      if (rate === null) rate = c.hourly_rate; else if (rate !== c.hourly_rate) mixed = true;
      if (type === "time") { const t = timesFor(s); if (t) delta += timeChangeDelta(s, c, t.start, t.end) ?? 0; }
    }
    if (missing === selected.length) return { allMissing: true as const };
    return { rate, mixed, missing, original: r2(original), proposed: r2(original + delta), delta: r2(delta) };
  })();
  const estimateNode = estimate && (
    "allMissing" in estimate
      ? <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">No hourly rate is set for {multi ? "these shifts" : "this shift"}, so the cost change can't be estimated. Set one in Roster → shift details.</p>
      : <div className="space-y-2 rounded-md border border-border bg-secondary/40 p-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-4">
            <span>Rate <b className="block tabular-nums">{estimate.mixed ? "Various" : `${fmtAUD(estimate.rate ?? 0)}/h`}</b></span>
            <span>Current cost <b className="block tabular-nums">{fmtAUD(estimate.original)}</b></span>
            <span>Proposed cost <b className="block tabular-nums">{fmtAUD(estimate.proposed)}</b></span>
            <span>Cost change <b className={`block tabular-nums ${estimate.delta > 0 ? "text-danger" : estimate.delta < 0 ? "text-success" : ""}`}>{fmtDelta(estimate.delta)}</b></span>
          </div>
          {estimate.missing > 0 && <p className="text-xs text-muted-foreground">{estimate.missing} selected shift{estimate.missing === 1 ? " has" : "s have"} no hourly rate and {estimate.missing === 1 ? "isn't" : "aren't"} included.</p>}
        </div>
  );

  const submit = async () => {
    if (!event || !review || busy) return;
    setBusy(true);
    const group_id = review.length > 1 ? crypto.randomUUID() : null;
    const rows = review.map((r) => ({
      event_id: event.id, variation_type: type, slot_id: r.slot_id, contractor_id: r.contractor_id, group_id,
      original: r.original, proposed: r.proposed, reason: f.reason, notes: f.notes || null,
      requested_by_user: session?.user.id, requested_by_name: f.requested_by || session?.user.email || "Unknown", status: "awaiting_ack",
    }));
    const { data, error } = await supabase.from("variations").insert(rows).select("id");
    if (error) { setBusy(false); return flash.show(errMsg(error), true); }
    if (showCosts && type === "additional" && data?.[0] && f.rate && Number(f.rate) >= 0) {
      const hours = Number(review[0].proposed.hours ?? 0);
      const { error: ce } = await supabase.from("variation_costs").update({ hourly_rate: Number(f.rate), proposed_cost: r2(hours * Number(f.rate)) }).eq("variation_id", data[0].id);
      if (ce) { setBusy(false); return flash.show(errMsg(ce), true); }
    }
    await reload(); setBusy(false); setStep(1); setF({}); setPer({}); setSlotIds([]); setSearch(""); onDone();
  };

  const dt = (k: string, label: string) => <Field label={label} hint="YYYY-MM-DD HH:mm"><input className="control-input h-11" value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder="2026-10-20 14:00" /></Field>;
  const txt = (k: string, label: string, placeholder?: string, hint?: string) => <Field label={label} hint={hint}><input className="control-input h-11" value={f[k] ?? ""} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} /></Field>;

  const slotPicker = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] flex-1">
          <Field label="Select shifts" hint="Tick one or more shifts. Ticked shifts stay ticked when you change the search."><input className="control-input h-11" placeholder="Search shift ID, position, zone or time…" value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
        </div>
        <div className="flex gap-2 pb-6">
          <button className="secondary-button h-11" disabled={!matches.length} onClick={selectAllShown}>Select all shown ({matches.length})</button>
          {slotIds.length > 0 && <button className="secondary-button h-11" onClick={() => setSlotIds([])}>Clear</button>}
        </div>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm font-semibold">{selected.length} shift{selected.length === 1 ? "" : "s"} selected</span>
          {selected.slice(0, 10).map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              {s.shift_ref}
              <button onClick={() => toggle(s.id)} aria-label={`Remove ${s.shift_ref}`}><X className="h-3 w-3" /></button>
            </span>
          ))}
          {selected.length > 10 && <span className="text-xs text-muted-foreground">and {selected.length - 10} more</span>}
        </div>
      )}
      <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {matches.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-secondary/40">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={slotIds.includes(s.id)} onChange={() => toggle(s.id)} />
            <span>{slotLabel(s, tz)}</span>
            {isDone(s) && <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">Finished</span>}
          </label>
        ))}
        {!matches.length && <p className="p-4 text-center text-sm text-muted-foreground">No shifts match your search.</p>}
      </div>
      {allMatches.length > SHOW_MAX && <p className="text-xs text-muted-foreground">Showing the first {SHOW_MAX} of {allMatches.length} shifts. Narrow your search to see the rest.</p>}
    </div>
  );

  const contractorIds = review ? [...new Set(review.map((r) => r.contractor_id))] : [];

  return (
    <Panel title={`Step ${step} of 3 · ${step === 1 ? "What kind of change?" : step === 2 ? typeLabel[type] : "Review and submit"}`}>
      {step === 1 && slot && <p className="mb-3 rounded-md bg-primary/10 p-3 text-sm"><b>{slot.shift_ref} · {slot.position}</b> is selected{multi ? ` with ${selected.length - 1} more` : ""}. Choose the kind of change.</p>}
      {step === 1 && (
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(typeLabel) as VType[]).map((t) => (
            <button key={t} onClick={() => { setType(t); setStep(2); }} className="rounded-md border border-border bg-secondary/50 p-6 text-left transition hover:border-primary">
              <p className="text-lg font-bold">{typeLabel[t]}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t === "time" ? "Change start or finish of one or more shifts." : t === "redeploy" ? "Move a guard or change role, position or location of one or more shifts." : "Extra guards beyond the original roster."}</p>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {type !== "additional" && slotPicker}
          {type === "time" && slot && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Enter the new start and finish for {multi ? "each shift" : "this shift"}</p>
              <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                {selected.map((s) => {
                  const t = timesFor(s);
                  const diff = t ? r2(hoursBetween(t.start, t.end) - hoursBetween(s.current_start, s.current_end)) : null;
                  return (
                    <div key={s.id} className="grid items-end gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_200px_200px]">
                      <div className="text-sm">
                        <p className="font-mono text-xs font-semibold">{s.shift_ref}</p>
                        <p>{s.role} · {s.position} · {s.zone}</p>
                        <p className="text-xs text-muted-foreground">Current {fmtDateTime(s.current_start, tz)}–{fmtTime(s.current_end, tz)} ({hoursBetween(s.current_start, s.current_end)} h)</p>
                        {isDone(s) && <p className="text-xs text-warning">Shift has finished. Once acknowledged and approved, the guard's recorded sign-off time moves to the new finish.</p>}
                        {t && diff !== 0 && <p className="text-xs font-semibold text-primary">New {fmtDateTime(t.start, tz)}–{fmtTime(t.end, tz)} ({diff! > 0 ? "+" : ""}{diff} h)</p>}
                      </div>
                      <Field label="New start" hint="YYYY-MM-DD HH:mm"><input className="control-input h-11" value={pv(s, "start")} onChange={(e) => setPv(s.id, "start", e.target.value)} /></Field>
                      <Field label="New finish" hint="YYYY-MM-DD HH:mm"><input className="control-input h-11" value={pv(s, "end")} onChange={(e) => setPv(s.id, "end", e.target.value)} /></Field>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {type === "redeploy" && slot && (
            <>
              {!multi && (
                <Field label="How?">
                  <select className="control-input h-11" value={rmode} onChange={(e) => set("mode", e.target.value)}>
                    <option value="change">Change role / position / location of this shift</option>
                    <option value="move">Move this guard to another vacant position</option>
                  </select>
                </Field>
              )}
              {rmode === "move" ? (
                <Field label="Vacant destination position">
                  <select className="control-input h-11" value={f.target ?? ""} onChange={(e) => set("target", e.target.value)}>
                    <option value="">— choose —</option>{vacantTargets.map((s) => <option key={s.id} value={s.id}>{slotLabel(s, tz)}</option>)}
                  </select>
                </Field>
              ) : (
                <>
                  <p className="text-sm font-semibold">Enter the new role, position and zone for {multi ? "each shift" : "this shift"}</p>
                  <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                    {selected.map((s) => (
                      <div key={s.id} className="space-y-2 rounded-md border border-border p-3">
                        <p className="text-sm"><span className="font-mono text-xs font-semibold">{s.shift_ref}</span> <span className="text-muted-foreground">· Current: {s.role} · {s.position} · {s.zone} · {fmtTime(s.current_start, tz)}–{fmtTime(s.current_end, tz)}</span></p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label="New role"><input className="control-input h-11" value={pv(s, "role")} onChange={(e) => setPv(s.id, "role", e.target.value)} /></Field>
                          <Field label="New position"><input className="control-input h-11" value={pv(s, "position")} onChange={(e) => setPv(s.id, "position", e.target.value)} /></Field>
                          <Field label="New zone / location"><input className="control-input h-11" value={pv(s, "zone")} onChange={(e) => setPv(s.id, "zone", e.target.value)} /></Field>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {dt("from", "Effective from")}
                    <Field label="Duration"><select className="control-input h-11" value={f.temporary ?? "no"} onChange={(e) => set("temporary", e.target.value)}><option value="no">Remainder of shift</option><option value="yes">Temporary, then return</option></select></Field>
                    {f.temporary === "yes" && dt("until", "Return at")}
                  </div>
                </>
              )}
            </>
          )}
          {type === "additional" && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Contractor"><select className="control-input h-11" value={f.contractor ?? ""} onChange={(e) => set("contractor", e.target.value)}><option value="">— choose —</option>{allowedContractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                {txt("count", "Number of additional guards")}
                {txt("role", "Role")}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">{txt("position", "Position")}{txt("zone", "Zone")}</div>
              <div className="grid gap-3 sm:grid-cols-2">{dt("start", "Start")}{dt("end", "Finish")}</div>
              {showCosts && (
                <Field label="Hourly rate (admins only)" hint={`Leave blank to use ${fmtAUD(suggested)}/h — the usual rate for this role in the roster`}>
                  <input className="control-input h-11" value={f.rate ?? ""} placeholder={String(suggested)} onChange={(e) => set("rate", e.target.value)} />
                </Field>
              )}
            </>
          )}
          {estimateNode}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Reason for change"><input className="control-input h-11" value={f.reason ?? ""} onChange={(e) => set("reason", e.target.value)} /></Field>
            <Field label="Requested by"><input className="control-input h-11" value={f.requested_by ?? session?.user.email ?? ""} onChange={(e) => set("requested_by", e.target.value)} /></Field>
          </div>
          {txt("notes", "Notes (optional)")}
          <div className="flex gap-2"><button className="secondary-button h-11" onClick={() => setStep(1)}>Back</button><button className="primary-button h-11" onClick={() => setStep(3)}>Review</button></div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {reviewError ? <p className="rounded-md bg-danger/15 p-3 text-sm text-danger">{reviewError}</p> : review && (
            <div className="grid gap-4 md:grid-cols-2">
              {review.length === 1 ? (
                <>
                  <div className="rounded-md border border-border p-4"><p className="mb-2 font-semibold">Original</p><Summary data={review[0].original} tz={tz} empty="Not in roster (additional scope)" /></div>
                  <div className="rounded-md border border-primary/50 p-4"><p className="mb-2 font-semibold">Proposed</p><Summary data={review[0].proposed} tz={tz} /></div>
                </>
              ) : (
                <div className="md:col-span-2"><ShiftList type={type} tz={tz} rows={review.map((r) => ({ key: r.slot_id ?? "", slot: slots.find((s) => s.id === r.slot_id), original: r.original, proposed: r.proposed }))} /></div>
              )}
              <div className="md:col-span-2">
                <Row label="Type" value={typeLabel[type]} />
                {review.length > 1 && <Row label="Shifts" value={review.length} />}
                <Row label="Contractor" value={contractorIds.length > 1 ? `${contractorIds.length} contractors` : contractorName(contractorIds[0] ?? null)} />
                <Row label="Reason" value={f.reason} />
                <Row label="Requested by" value={f.requested_by || session?.user.email} />
              </div>
              {estimateNode && <div className="md:col-span-2">{estimateNode}</div>}
            </div>
          )}
          {flash.node}
          <div className="flex gap-2"><button className="secondary-button h-12" onClick={() => setStep(2)}>Back</button><button className="primary-button h-12" disabled={!!reviewError || busy} onClick={submit}>{review && review.length > 1 ? `Submit variation for ${review.length} shifts` : "Submit variation"}</button></div>
        </div>
      )}
    </Panel>
  );
}

function ShiftList({ type, tz, rows, linkSlots }: { type: VType; tz: string; linkSlots?: boolean; rows: { key: string; slot?: Slot; original: Record<string, any>; proposed: Record<string, any>; extra?: React.ReactNode }[] }) {
  return (
    <div className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
      {rows.map((r) => (
        <div key={r.key} className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
          <span className="font-semibold">{r.slot ? (linkSlots ? <Link to={`/admin/roster?shift=${r.slot.id}`} className="hover:text-primary hover:underline">{r.slot.shift_ref} · {r.slot.position}</Link> : `${r.slot.shift_ref} · ${r.slot.position}`) : "Shift"}</span>
          <span className="text-muted-foreground">{describe(type, r.original, tz)}</span>
          <span>→ {describe(type, r.proposed, tz)}</span>
          <span className="sm:text-right">{r.extra}</span>
        </div>
      ))}
    </div>
  );
}

function Summary({ data, tz, empty }: { data: Record<string, any>; tz: string; empty?: string }) {
  const entries = Object.entries(data).filter(([k, v]) => v !== null && v !== "" && k !== "target_slot_id");
  if (!entries.length) return <p className="text-sm text-muted-foreground">{empty ?? "—"}</p>;
  const label: Record<string, string> = { start: "Start", end: "Finish", hours: "Hours", role: "Role", position: "Position", zone: "Zone", from: "Effective from", until: "Return at", count: "Additional guards", guard: "Guard" };
  return <>{entries.map(([k, v]) => <Row key={k} label={label[k] ?? k} value={["start", "end", "from", "until"].includes(k) ? fmtDateTime(String(v), tz) : String(v)} />)}</>;
}

function Register({ initialOpenId, initialStatus }: { initialOpenId?: string | null; initialStatus?: string | null }) {
  const { variations, contractors, contractorName, event, setEventId, showCosts, variationCosts, slots } = useOps();
  const [status, setStatus] = useState(initialStatus ?? "");
  const [type, setType] = useState("");
  const [contractor, setContractor] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Alert links (?open=<id>) may arrive before variations load, or for another event: switch event, then open once it appears.
  const [pendingOpen, setPendingOpen] = useState(initialOpenId ?? null);
  useEffect(() => {
    if (!pendingOpen) return;
    const v = variations.find((x) => x.id === pendingOpen);
    if (v) { setOpenKey(requestKey(v)); setPendingOpen(null); return; }
    let cancelled = false;
    supabase.from("variations").select("event_id").eq("id", pendingOpen).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      if (!data) setPendingOpen(null);
      else if (data.event_id !== event?.id) setEventId(data.event_id);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOpen, variations, event?.id]);
  const tz = event?.timezone ?? "Australia/Sydney";
  const requests = useMemo(() => groupVariations(variations).map((items) => ({ key: requestKey(items[0]), items, lead: items[0], status: requestStatus(items.map((v) => v.status)) })), [variations]);
  const rows = requests.filter((r) => (!status || (status === "pending" ? ["awaiting_ack", "awaiting_approval"].includes(r.status) : r.status === status)) && (!type || r.lead.variation_type === type) && (!contractor || r.items.some((v) => v.contractor_id === contractor)));
  const current = openKey ? requests.find((r) => r.key === openKey) : null;
  const exportAll = () => {
    if (!event) return;
    const refs = new Map(slots.map((s) => [s.id, s.shift_ref]));
    downloadText(`${event.name} - all variations.csv`, variationsToCsv(variations, {
      timeZone: tz, contractorName, shiftRef: (id) => (id ? refs.get(id) ?? "" : ""),
      typeLabel: (t) => typeLabel[t as VType] ?? t, statusLabel: (s) => statusLabel[s] ?? s,
      costs: showCosts ? variationCosts : undefined,
    }));
  };
  const costOf = (items: Variation[]) => items.reduce((t, v) => t + (variationCosts.get(v.id)?.cost_delta ?? 0), 0);
  return (
    <Panel title="Variation register" actions={
      <>
        <select className="control-input h-10 w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="pending">All pending</option>{["awaiting_ack", "awaiting_approval", "approved", "declined", "returned"].map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}</select>
        <select className="control-input h-10 w-auto" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{(Object.keys(typeLabel) as VType[]).map((t) => <option key={t} value={t}>{typeLabel[t]}</option>)}</select>
        <select className="control-input h-10 w-auto" value={contractor} onChange={(e) => setContractor(e.target.value)}><option value="">All contractors</option>{contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button className="secondary-button h-10 whitespace-nowrap px-3" disabled={!variations.length} onClick={exportAll} title="Download every variation for this event as a spreadsheet (CSV)"><Download className="mr-2 h-4 w-4" />Export all</button>
      </>
    }>
      {showCosts && (() => {
        const sum = (st: string[]) => rows.reduce((t, r) => t + costOf(r.items.filter((v) => st.includes(v.status))), 0);
        return <p className="mb-3 text-sm text-muted-foreground">Cost impact · approved <b className="text-foreground tabular-nums">{fmtDelta(r2(sum(["approved"])))}</b> · pending <b className="text-foreground tabular-nums">{fmtDelta(r2(sum(PENDING)))}</b></p>;
      })()}
      <Table head={["ID", "Type", "Requested", "Contractor", "Reason", "Acknowledged", "Approved", ...(showCosts ? ["Cost impact"] : []), "Status"]} empty={rows.length === 0}>
        {rows.map(({ key, items, lead, status: st }) => {
          const n = items.length;
          const cids = [...new Set(items.map((v) => v.contractor_id))];
          const acked = items.filter((v) => v.ack_at).length;
          const approved = items.filter((v) => v.status === "approved").length;
          return (
            <tr key={key} className="cursor-pointer hover:bg-secondary/40" onClick={() => setOpenKey(key)}>
              <td className="px-3 py-2 font-mono text-xs">{lead.ref}{n > 1 && <span className="mt-0.5 block font-sans font-semibold text-primary">{n} shifts</span>}</td>
              <td className="px-3 py-2">{typeLabel[lead.variation_type]}</td>
              <td className="px-3 py-2">{lead.requested_by_name}<br /><span className="text-xs text-muted-foreground">{fmtDateTime(lead.created_at, tz)}</span></td>
              <td className="px-3 py-2">{cids.length > 1 ? `${cids.length} contractors` : contractorName(cids[0] ?? null)}</td>
              <td className="max-w-[200px] truncate px-3 py-2">{lead.reason}</td>
              <td className="px-3 py-2">{n > 1 ? (acked ? `${acked} of ${n}` : "—") : lead.ack_by_name ?? "—"}</td>
              <td className="px-3 py-2">{n > 1 ? (approved ? `${approved} of ${n}` : "—") : lead.status === "approved" ? lead.approved_by_name : "—"}</td>
              {showCosts && <td className="px-3 py-2 tabular-nums">{items.some((v) => variationCosts.has(v.id)) ? fmtDelta(r2(costOf(items))) : fmtDelta(undefined)}</td>}
              <td className="px-3 py-2"><Pill status={st} /></td>
            </tr>
          );
        })}
      </Table>
      {current && <VariationDrawer items={current.items} onClose={() => setOpenKey(null)} />}
    </Panel>
  );
}

function VariationDrawer({ items, onClose }: { items: Variation[]; onClose: () => void }) {
  const { event, slots, isManager, canApprove, can, contractorName, reload, showCosts, variationCosts } = useOps();
  const canAck = can("acknowledge_variations");
  const canDecide = canApprove || canAck;
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const flash = useFlash();
  const tz = event?.timezone ?? "Australia/Sydney";
  const v = items[0];
  const n = items.length;
  const multi = n > 1 && !!v.group_id;
  const status = requestStatus(items.map((x) => x.status));
  const slot = slots.find((s) => s.id === v.slot_id);
  const vc = variationCosts.get(v.id);
  const cids = [...new Set(items.map((x) => x.contractor_id))];
  const toAck = items.filter((x) => ["awaiting_ack", "requested", "returned"].includes(x.status)).length;
  const toApprove = items.filter((x) => x.status === "awaiting_approval").length;
  const pending = items.filter((x) => PENDING.includes(x.status)).length;
  const approvedCount = items.filter((x) => x.status === "approved").length;
  const ackedCount = items.filter((x) => x.ack_at).length;
  const plural = (k: number) => (multi ? ` ${k} shift${k === 1 ? "" : "s"}` : "");

  const run = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const { error } = await supabase.rpc(fn as any, args as any);
    setBusy(false);
    if (error) flash.show(errMsg(error), true); else { flash.show(ok); setNotes(""); reload(); }
  };
  const acknowledge = () => multi
    ? run("acknowledge_variation_group", { _group_id: v.group_id, _comments: notes || null }, "Acknowledged. Now awaiting approval.")
    : run("acknowledge_variation", { _id: v.id, _comments: notes || null }, "Acknowledged. Now awaiting approval.");
  const approve = () => multi
    ? run("approve_variation_group", { _group_id: v.group_id, _notes: notes || null }, `Approved ${pending} shifts — the current roster has been updated.`)
    : run("approve_variation", { _id: v.id, _notes: notes || null }, "Approved — the current roster has been updated.");
  const decide = (d: "returned" | "declined") => multi
    ? run("decide_variation_group", { _group_id: v.group_id, _decision: d, _notes: notes || null }, d === "returned" ? "Returned for clarification." : "Declined.")
    : run("decide_variation", { _id: v.id, _decision: d, _notes: notes || null }, d === "returned" ? "Returned for clarification." : "Declined.");

  const totals = items.reduce((t, x) => {
    const c = variationCosts.get(x.id);
    if (!c) return t;
    return { priced: t.priced + 1, before: t.before + c.original_cost, after: t.after + c.proposed_cost, delta: t.delta + c.cost_delta };
  }, { priced: 0, before: 0, after: 0, delta: 0 });

  return (
    <Drawer open onClose={onClose} title={`${v.ref} · ${typeLabel[v.variation_type]}${multi ? ` · ${n} shifts` : ""}`}>
      <div className="space-y-5">
        <Pill status={status} />
        {!multi && slot && <Row label="Shift" value={can("view_roster") ? <Link to={`/admin/roster?shift=${slot.id}`} className="hover:text-primary hover:underline">{slot.shift_ref} · {slot.position} →</Link> : `${slot.shift_ref} · ${slot.position}`} />}
        <Row label="Contractor" value={cids.length > 1 ? cids.map((c) => contractorName(c)).join(", ") : contractorName(cids[0] ?? null)} />
        <Row label="Reason" value={v.reason} />
        {v.notes && <Row label="Notes" value={v.notes} />}
        {multi ? (
          <ShiftList type={v.variation_type} tz={tz} linkSlots={can("view_roster")} rows={[...items].sort((a, b) => String(a.original?.start ?? "").localeCompare(String(b.original?.start ?? ""))).map((x) => ({
            key: x.id, slot: slots.find((s) => s.id === x.slot_id), original: x.original, proposed: x.proposed,
            extra: <span className="inline-flex items-center gap-2">{showCosts && variationCosts.get(x.id) && <span className="text-xs tabular-nums text-muted-foreground">{fmtDelta(variationCosts.get(x.id)!.cost_delta)}</span>}<Pill status={x.status} label={x.status === "awaiting_ack" ? "Awaiting ack" : undefined} /></span>,
          }))} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3"><p className="mb-1 text-sm font-semibold">Original</p><Summary data={v.original} tz={tz} empty="Additional scope" /></div>
            <div className="rounded-md border border-primary/50 p-3"><p className="mb-1 text-sm font-semibold">Proposed</p><Summary data={v.proposed} tz={tz} /></div>
          </div>
        )}
        {showCosts && (
          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <p className="mb-1 text-sm font-semibold">Cost <span className="text-xs font-normal text-muted-foreground">(admins only)</span></p>
            {multi ? (totals.priced ? <>
              <Row label="Shifts priced" value={`${totals.priced} of ${n}`} />
              <Row label="Cost before" value={fmtAUD(r2(totals.before))} />
              <Row label="Cost after" value={fmtAUD(r2(totals.after))} />
              <Row label="Cost change" value={<span className={totals.delta > 0 ? "text-danger" : totals.delta < 0 ? "text-success" : ""}>{fmtDelta(r2(totals.delta))}</span>} />
            </> : <p className="text-sm text-muted-foreground">No hourly rates are set for these shifts.</p>)
            : vc ? <>
              <Row label="Hourly rate" value={`${fmtAUD(vc.hourly_rate)}/h`} />
              <Row label="Paid hours" value={`${vc.original_hours} → ${vc.proposed_hours}`} />
              <Row label="Cost before" value={fmtAUD(vc.original_cost)} />
              <Row label="Cost after" value={fmtAUD(vc.proposed_cost)} />
              <Row label="Cost change" value={<span className={vc.cost_delta > 0 ? "text-danger" : vc.cost_delta < 0 ? "text-success" : ""}>{fmtDelta(vc.cost_delta)}</span>} />
            </> : <p className="text-sm text-muted-foreground">Not priced — this request was made before costs were added.</p>}
          </div>
        )}
        <ol className="space-y-2 border-l border-border pl-4 text-sm">
          <li><b>Requested</b> by {v.requested_by_name} · {fmtDateTime(v.created_at, tz)}</li>
          {multi ? <>
            {ackedCount > 0 && <li><b>Acknowledged</b> · {ackedCount} of {n} shifts</li>}
            {approvedCount > 0 && <li><b>Approved and roster updated</b> · {approvedCount} of {n} shifts</li>}
          </> : <>
            {v.ack_at && <li><b>Acknowledged</b> by {v.ack_by_name} · {fmtDateTime(v.ack_at, tz)}{v.ack_comments && ` — “${v.ack_comments}”`}</li>}
            {v.approved_at && <li><b>{v.status === "approved" ? "Approved" : v.status === "returned" ? "Returned" : "Declined"}</b> by {v.approved_by_name} · {fmtDateTime(v.approved_at, tz)}{v.decision_notes && ` — “${v.decision_notes}”`}</li>}
            {v.applied_at && <li><b>Roster updated</b> · {fmtDateTime(v.applied_at, tz)}</li>}
          </>}
        </ol>

        {pending > 0 && (
          <div className="space-y-3 rounded-md border border-border p-4">
            <Field label="Comments (optional)"><input className="control-input h-10" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <div className="flex flex-wrap gap-2">
              {canAck && !canApprove && toAck > 0 && <button className="primary-button h-11" disabled={busy} onClick={acknowledge}>Acknowledge{plural(toAck)} as contractor</button>}
              {canApprove && pending > 0 && <button className="primary-button h-11" disabled={busy} onClick={approve}>Approve{plural(pending)}</button>}
              {canDecide && <button className="secondary-button h-11" disabled={busy} onClick={() => decide("returned")}>Return for clarification</button>}
              {canDecide && <button className="secondary-button h-11 text-danger" disabled={busy} onClick={() => decide("declined")}>Decline{multi ? " all pending" : ""}</button>}
            </div>
            {!canApprove && toApprove > 0 && <p className="text-xs text-muted-foreground">You can't approve variations. Senior Management or a Super Admin needs to approve this one.</p>}
            {canApprove && toAck > 0 && <p className="text-xs text-muted-foreground">The contractor hasn't acknowledged {multi ? "every shift" : "this"} yet — you can still approve directly.</p>}
            <p className="text-xs text-muted-foreground">Acknowledgement confirms the contractor has received the change. It is not approval.</p>
          </div>
        )}
        {approvedCount > 0 && (
          <button className="primary-button h-11 w-full" onClick={() => navigate(`/admin/communications?variation=${(items.find((x) => x.status === "approved") ?? v).id}`)}>Message affected guards</button>
        )}
        {flash.node}
      </div>
    </Drawer>
  );
}
