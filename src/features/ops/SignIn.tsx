import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { activeAttendanceBySlot, effectiveDeployment, fmtDateTime, fmtTime, signInWindowFor } from "@/lib/roster";
import { errMsg, useOps } from "./OpsContext";
import { Field, Page, Panel, Table, useFlash } from "./ui";
import { QrScanner, parseGuardQr, useHardwareScanner } from "./QrScanner";

const WINDOWS = [1, 2, 4, 8, 24];

/** Contractor sign-in desk: link arriving guards to open positions. */
export function SignInPage() {
  const { slots, guards, attendance, contractors, isManager, can, myContractorIds, event, now, reload, contractorName } = useOps();
  const tz = event?.timezone ?? "Australia/Sydney";
  const myContractors = isManager ? contractors : contractors.filter((c) => myContractorIds.includes(c.id));
  const [contractor, setContractor] = useState<string>(myContractors.length === 1 ? myContractors[0].id : "");
  const [windowH, setWindowH] = useState(2);
  const [slotId, setSlotId] = useState("");
  const [q, setQ] = useState("");
  const [guardId, setGuardId] = useState("");
  const [busy, setBusy] = useState(false);
  const flash = useFlash();

  // "Sign a guard on" from the Roster opens the desk with ?slot=<id>: pick that position for the user.
  const [params, setParams] = useSearchParams();
  const [fromRoster, setFromRoster] = useState<string | null>(() => params.get("slot"));
  useEffect(() => {
    if (!fromRoster) return;
    const s = slots.find((x) => x.id === fromRoster);
    if (!s) return;
    if (s.contractor_id && myContractors.some((c) => c.id === s.contractor_id)) setContractor(s.contractor_id);
    setWindowH((w) => Math.max(w, signInWindowFor(s.current_start, new Date())));
    setSlotId(s.id);
    setFromRoster(null);
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromRoster, slots]);

  const open = attendance.filter((a) => !a.signed_off_at);
  const bySlot = activeAttendanceBySlot(attendance);
  // Guards already on a position can't be picked; guards signed on without one (older phone sign-ons) can be placed.
  const onGuard = new Set(open.filter((a) => a.slot_id).map((a) => a.guard_id));
  const unplaced = new Map(open.filter((a) => !a.slot_id).map((a) => [a.guard_id, a.id]));
  const allowedIds = new Set(myContractors.map((c) => c.id));
  const inScope = (cid: string | null) => (contractor ? cid === contractor : isManager || (cid !== null && allowedIds.has(cid)));

  const t = now.getTime();
  const openSlots = useMemo(() => slots
    .filter((s) => s.status === "active" && inScope(s.contractor_id) && !bySlot.has(s.id)
      && new Date(s.current_end).getTime() > t && new Date(s.current_start).getTime() <= t + windowH * 36e5)
    .sort((a, b) => a.current_start.localeCompare(b.current_start) || a.zone.localeCompare(b.zone)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [slots, attendance, contractor, windowH, t]);

  const [sq, setSq] = useState("");
  const [zone, setZone] = useState("");
  const zones = useMemo(() => [...new Set(openSlots.map((s) => effectiveDeployment(s, now).zone).filter(Boolean))].sort(), [openSlots, now]);
  const filteredSlots = openSlots.filter((s) => {
    const d = effectiveDeployment(s, now);
    if (zone && d.zone !== zone) return false;
    return !sq || `${d.position} ${d.zone} ${d.role} ${s.shift_ref}`.toLowerCase().includes(sq.toLowerCase());
  });

  const guardMatches = guards.filter((g) => g.status !== "suspended" && inScope(g.contractor_id) && !onGuard.has(g.id)
    && (!q || `${g.name} ${g.employee_id} ${g.licence_number}`.toLowerCase().includes(q.toLowerCase()))).slice(0, 30);

  const onPost = open.filter((a) => a.slot_id && slots.find((s) => s.id === a.slot_id && inScope(s.contractor_id)));
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const guardById = new Map(guards.map((g) => [g.id, g]));

  const signOn = async () => {
    if (!slotId || !guardId) return flash.show("Pick a position and a guard.", true);
    setBusy(true); flash.clear();
    const attId = unplaced.get(guardId);
    const { error } = attId
      ? await supabase.rpc("allocate_guard", { _attendance_id: attId, _slot_id: slotId })
      : await supabase.rpc("manager_sign_on", { _guard_id: guardId, _slot_id: slotId });
    setBusy(false);
    if (error) return flash.show(errMsg(error), true);
    flash.show(`${guardById.get(guardId)?.name} signed on to ${slotById.get(slotId)?.position}.`);
    setSlotId(""); setGuardId(""); setQ(""); setSq(""); reload();
  };
  const [scanning, setScanning] = useState(false);
  const onScan = (text: string) => {
    setScanning(false);
    const gid = parseGuardQr(text);
    const g = gid ? guardById.get(gid) : undefined;
    if (!g) return flash.show("That QR code isn't a guard pass for this system.", true);
    if (g.status === "suspended") return flash.show(`${g.name}'s account is suspended or deleted, so they can't be signed on.`, true);
    if (!inScope(g.contractor_id)) return flash.show(`${g.name} belongs to ${contractorName(g.contractor_id)}, not this contractor.`, true);
    if (onGuard.has(g.id)) return flash.show(`${g.name} is already signed on.`, true);
    flash.clear(); setQ(g.name); setGuardId(g.id);
  };
  useHardwareScanner((text) => { setSq((v) => (v.toUpperCase().includes("GUARDP") ? "" : v)); onScan(text); }, !scanning);
  const scanned = guardId ? guardById.get(guardId) : undefined;
  const picked = slotId ? slotById.get(slotId) : undefined;

  if (!isManager && myContractors.length === 0) return <Page><Panel title="Sign-in desk"><p className="text-muted-foreground">Your account isn't linked to a contractor yet. Ask an administrator to add you.</p></Panel></Page>;

  return (
    <Page>
      <Panel title="Sign-in desk" description="When a guard arrives: find the guard, allocate them to a position, then sign them on." actions={
        <>
          <select className="control-input h-10 w-auto" value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Filter by zone / location">
            <option value="">All zones</option>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <select className="control-input h-10 w-auto" value={contractor} onChange={(e) => { setContractor(e.target.value); setSlotId(""); setGuardId(""); }}>
            {(isManager || myContractors.length > 1) && <option value="">{isManager ? "All contractors" : "All my contractors"}</option>}
            {myContractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="control-input h-10 w-auto" value={windowH} onChange={(e) => setWindowH(+e.target.value)}>
            {(WINDOWS.includes(windowH) ? WINDOWS : [...WINDOWS, windowH]).map((h) => <option key={h} value={h}>Starting within {h}h</option>)}
          </select>
        </>
      }>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <p className="mb-2 font-semibold">1. Scan or look up guard</p>
            <button onClick={() => setScanning(true)} className="primary-button mb-1 h-16 w-full gap-3 text-lg shadow-control">
              <QrCode className="h-8 w-8" aria-hidden />
              <span className="text-left leading-tight">Scan guard QR<span className="block text-xs font-semibold opacity-80">Use the desk scanner any time, or click to use the laptop camera</span></span>
            </button>
            <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-success" aria-hidden />Desk scanner ready — hold the guard's pass under it</p>
            {scanned ? (
              <div className="rounded-md border border-primary bg-primary/10 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold">{scanned.name}</p>
                    <p className="text-muted-foreground">Employee {scanned.employee_id} · Licence {scanned.licence_number || "—"} · {contractorName(scanned.contractor_id)}</p>
                    {unplaced.has(scanned.id) && <p className="text-xs font-semibold text-warning">Already signed on without a position — pick one below to place them.</p>}
                  </div>
                  <button className="secondary-button h-9 px-3 text-xs" onClick={() => { setGuardId(""); setQ(""); }}>Change</button>
                </div>
              </div>
            ) : (
              <>
                <Field label="Or search name, employee ID or licence">
                  <input className="control-input h-11" value={q} onChange={(e) => { setQ(e.target.value); setGuardId(""); }} placeholder="Start typing…" />
                </Field>
                <div className="mt-2 max-h-[min(200px,calc(100vh-560px))] min-h-[120px] overflow-y-auto rounded-md border border-border">
                  {guardMatches.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No available guards match.</p> : guardMatches.map((g) => (
                    <button key={g.id} onClick={() => setGuardId(g.id)} className="flex w-full justify-between border-b border-border px-3 py-2 text-left text-sm hover:bg-secondary">
                      <span className="font-semibold">{g.name}{unplaced.has(g.id) && <span className="ml-2 text-xs font-normal text-warning">Signed on · needs a position</span>}</span><span className="text-xs text-muted-foreground">{g.employee_id} · {contractorName(g.contractor_id)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className={guardId || picked ? "" : "opacity-60"}>
            <p className="mb-2 font-semibold">2. Allocate to position / shift · {openSlots.length} open</p>
            {picked && (
              <div className="mb-2 rounded-md border border-primary bg-primary/10 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold">{effectiveDeployment(picked, now).position} · {effectiveDeployment(picked, now).zone}</p>
                    <p className="text-muted-foreground">{picked.shift_ref} · {effectiveDeployment(picked, now).role} · {fmtDateTime(picked.current_start, tz)}–{fmtTime(picked.current_end, tz)}</p>
                  </div>
                  <button className="secondary-button h-9 px-3 text-xs" onClick={() => setSlotId("")}>Change</button>
                </div>
                {!guardId && <p className="mt-1 text-xs font-semibold text-primary">Position chosen — now scan or look up the guard in step 1.</p>}
              </div>
            )}
            <input className="control-input mb-2 h-11" value={sq} onChange={(e) => setSq(e.target.value)} placeholder={guardId ? "Search position, role or shift ID…" : "Find the guard first, then search positions…"} />
            <div className="max-h-[min(300px,calc(100vh-460px))] min-h-[160px] overflow-y-auto rounded-md border border-border">
              {filteredSlots.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{sq || zone ? "No open positions match." : "No open positions in this window."}</p> : filteredSlots.slice(0, 300).map((s) => {
                const d = effectiveDeployment(s, now);
                const started = new Date(s.current_start).getTime() <= t;
                return (
                  <button key={s.id} disabled={!guardId} onClick={() => setSlotId(s.id)} className={`flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm disabled:cursor-not-allowed ${slotId === s.id ? "bg-primary/15" : "enabled:hover:bg-secondary"}`}>
                    <span><b>{d.position}</b> · {d.zone}<br /><span className="text-xs text-muted-foreground">{d.role} · {s.shift_ref}{!contractor && ` · ${contractorName(s.contractor_id)}`}</span></span>
                    <span className={`whitespace-nowrap text-xs ${started ? "text-destructive" : "text-muted-foreground"}`}>{fmtTime(s.current_start, tz)}–{fmtTime(s.current_end, tz)}{started && " · started"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 font-semibold">3. Sign guard on</p>
          <button className="primary-button h-14 w-full text-lg" disabled={busy || !slotId || !guardId || !can("sign_on_guards")} onClick={signOn}>
            {!can("sign_on_guards") ? "You can view this desk but not sign guards on" : busy ? "Signing on…" : slotId && guardId ? `Sign ${guardById.get(guardId)?.name} on to ${slotById.get(slotId)?.position}` : !guardId ? "Find a guard first" : "Choose a position"}
          </button>
          <div className="mt-3">{flash.node}</div>
        </div>
      </Panel>
      <Panel title={`On post now · ${onPost.length}`}>
        <Table head={["Guard", "Position", "Zone", "Signed on", "Auto sign-off"]} empty={onPost.length === 0}>
          {onPost.slice(0, 300).map((a) => {
            const s = slotById.get(a.slot_id!)!;
            return (
              <tr key={a.id}>
                <td className="px-3 py-2 font-semibold">{guardById.get(a.guard_id)?.name ?? "—"}</td>
                <td className="px-3 py-2">{can("view_roster") ? <Link to={`/admin/roster?shift=${s.id}`} className="font-semibold underline-offset-2 hover:text-primary hover:underline" title="Open this shift in the roster">{s.position}</Link> : s.position}</td>
                <td className="px-3 py-2">{s.zone}</td>
                <td className="px-3 py-2">{fmtTime(a.signed_on_at, tz)}</td>
                <td className="px-3 py-2">{fmtTime(s.current_end, tz)}</td>
              </tr>
            );
          })}
        </Table>
      </Panel>
      {scanning && <QrScanner onScan={onScan} onClose={() => setScanning(false)} />}
    </Page>
  );
}
