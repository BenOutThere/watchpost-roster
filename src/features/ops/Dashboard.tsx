import { LiveMapPage } from "./LiveMap";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, MapPin } from "lucide-react";
import { activeAttendanceBySlot, effectiveDeployment, fmtAUD, fmtDelta, fmtTime, groupVariations, matchesRosterView, pendingVariationSlotIds, requestStatus, rosterCostTotals, slotStatus, staffingMetrics, SOON_HOURS, type RosterView, type Slot, type SlotStatus } from "@/lib/roster";
import { useOps } from "./OpsContext";
import { BigStat, BlurredAmount, CostsToggle, Page, Panel, Pill, Table } from "./ui";

export function DashboardPage() {
  const { can, slots, attendance, variations, event, now, contractorName, guardName, myContractorIds, isManager, showCosts, slotCosts, variationCosts } = useOps();
  const [filter, setFilter] = useState<SlotStatus | "Now">("Now");
  const [q, setQ] = useState("");
  const [costsOpen, setCostsOpen] = useState(false);
  const tz = event?.timezone ?? "Australia/Sydney";

  const scoped = useMemo(() => (isManager ? slots : slots.filter((s) => s.contractor_id && myContractorIds.includes(s.contractor_id))), [slots, isManager, myContractorIds]);
  const metrics = staffingMetrics(scoped, attendance, now);
  const bySlot = useMemo(() => activeAttendanceBySlot(attendance), [attendance]);
  // Same rules as the Roster quick-filter tabs, so each tile's count matches the list it opens.
  const pendingIds = useMemo(() => pendingVariationSlotIds(variations), [variations]);
  const inView = (v: RosterView) => scoped.filter((s) => matchesRosterView(v, s, bySlot, now, pendingIds)).sort((a, b) => a.current_start.localeCompare(b.current_start));
  const startingSoon = inView("soon");
  const finishingSoon = inView("ending").sort((a, b) => a.current_end.localeCompare(b.current_end));
  const vacant = inView("vacant");
  // Count requests, not shifts: one request can cover several shifts.
  const requestStatuses = groupVariations(variations).map((g) => requestStatus(g.map((v) => v.status)));
  const awaitingAck = requestStatuses.filter((st) => st === "awaiting_ack");
  const awaitingApproval = requestStatuses.filter((st) => st === "awaiting_approval");

  const rows = scoped
    .map((s) => ({ s, status: slotStatus(s, bySlot, now) }))
    .filter(({ status }) => (filter === "Now" ? status === "Filled" || status === "Missing" : status === filter))
    .filter(({ s }) => !q || `${s.position} ${s.zone} ${s.role} ${contractorName(s.contractor_id)}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.status === "Missing" ? -1 : 0) - (b.status === "Missing" ? -1 : 0));

  if (!event) return <Page><Panel title="No event yet" description="Create your first event in Settings to start."><Link className="primary-button" to="/admin/settings">Open Settings</Link></Panel></Page>;

  return (
    <Page>
      <div className="grid gap-4 md:grid-cols-3">
        <BigStat label="Guards rostered" value={metrics.rostered} />
        <BigStat label="Guards signed on" value={metrics.signedOn} tone="success" />
        <BigStat label="Missing guards" value={metrics.missing} tone={metrics.missing ? "danger" : "default"} />
      </div>

      {showCosts && slotCosts.size > 0 && (() => {
        const totals = rosterCostTotals(scoped, slotCosts);
        const pending = variations.filter((v) => ["awaiting_ack", "awaiting_approval", "returned"].includes(v.status)).reduce((t, v) => t + (variationCosts.get(v.id)?.cost_delta ?? 0), 0);
        return (
          <div className="panel text-sm">
            <CostsToggle open={costsOpen} onToggle={() => setCostsOpen((o) => !o)} />
            {costsOpen && (
              <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-4">
                <CostFigure label="Original roster cost" value={fmtAUD(totals.original)} />
                <CostFigure label="Current approved cost" value={fmtAUD(totals.current)} />
                <CostFigure label="Approved variations" value={fmtDelta(totals.variance)} danger={totals.variance > 0} />
                <CostFigure label="Pending variations" value={fmtDelta(Math.round(pending * 100) / 100)} />
                <p className="text-xs text-muted-foreground sm:col-span-4">Hover over (or tap) an amount to reveal it.</p>
              </div>
            )}
          </div>
        );
      })()}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniList title={`Starting within ${SOON_HOURS} hour`} view="soon" slots={startingSoon} label={(s) => `${fmtTime(s.current_start, tz)} · ${s.position} · ${s.zone}`} />
        <MiniList title={`Finishing within ${SOON_HOURS} hour`} view="ending" slots={finishingSoon} label={(s) => `${fmtTime(s.current_end, tz)} · ${s.position} · ${s.zone}`} />
        <MiniList title="Vacant positions" view="vacant" slots={vacant} label={(s) => `${s.position} · ${s.zone}`} tone="danger" />
        <div className="panel p-4 text-sm">
          <Link to="/admin/variations?status=pending" className="mb-2 flex items-center justify-between font-semibold hover:text-primary"><span>Variations</span><span className="flex items-center text-xs font-semibold text-primary">View all<ChevronRight className="h-4 w-4" /></span></Link>
          <Link to="/admin/variations?status=awaiting_ack" className="-mx-2 flex justify-between rounded px-2 py-1.5 hover:bg-secondary"><span className="text-muted-foreground">Awaiting acknowledgement</span><span className="font-bold tabular-nums">{awaitingAck.length}</span></Link>
          <Link to="/admin/variations?status=awaiting_approval" className="-mx-2 flex justify-between rounded px-2 py-1.5 hover:bg-secondary"><span className="text-muted-foreground">Awaiting approval</span><span className="font-bold tabular-nums">{awaitingApproval.length}</span></Link>
          <Link to="/admin/variations?status=pending" className="-mx-2 flex justify-between rounded px-2 py-1.5 hover:bg-secondary"><span className="text-muted-foreground">Pending total</span><span className="font-bold tabular-nums">{awaitingAck.length + awaitingApproval.length}</span></Link>
        </div>
      </div>

      <Panel title="Live staffing" description="Updates automatically as guards sign on, sign off or are redeployed." actions={
        <>
          {can("view_locations") && <a href="#live-map" className="secondary-button h-10"><MapPin className="mr-1 h-4 w-4" /> Live Map</a>}
          <input className="control-input h-10 w-56" placeholder="Search position, guard…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="control-input h-10 w-auto" value={filter} onChange={(e) => setFilter(e.target.value as SlotStatus | "Now")}>
            <option value="Now">On now</option><option value="Missing">Missing</option><option value="Filled">Filled</option><option value="Upcoming">Upcoming</option><option value="Completed">Completed</option>
          </select>
        </>
      }>
        <Table head={["Shift time", "Position", "Location", "Contractor", "Signed-on guard", "Status"]} empty={rows.length === 0}>
          {rows.slice(0, 400).map(({ s, status }) => {
            const d = effectiveDeployment(s, now);
            const a = bySlot.get(s.id);
            return (
              <tr key={s.id}>
                <td className="px-3 py-2 tabular-nums">{fmtTime(s.current_start, tz)}–{fmtTime(s.current_end, tz)}</td>
                <td className="px-3 py-2">{d.position}{d.temporary && <span className="ml-1 text-xs text-warning">(temp)</span>}</td>
                <td className="px-3 py-2">{d.zone}</td>
                <td className="px-3 py-2">{contractorName(s.contractor_id)}</td>
                <td className="px-3 py-2">{a ? guardName(a.guard_id) : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2"><Pill status={status} /></td>
              </tr>
            );
          })}
        </Table>
      </Panel>
      {can("view_locations") && <LiveMapPage embedded />}
    </Page>
  );
}

function CostFigure({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <BlurredAmount value={value} className={`text-xl font-bold ${danger ? "text-danger" : ""}`} />
    </div>
  );
}

/** Dashboard tile: the heading opens the matching Roster tab, each line opens that shift. */
function MiniList({ title, view, slots, label, tone }: { title: string; view: RosterView; slots: Slot[]; label: (s: Slot) => string; tone?: "danger" }) {
  return (
    <div className="panel p-4 text-sm">
      <Link to={`/admin/roster?view=${view}`} className="mb-2 flex items-center justify-between gap-2 font-semibold hover:text-primary">
        <span>{title}</span>
        <span className="flex items-center gap-1"><span className={`tabular-nums ${tone === "danger" && slots.length ? "text-danger" : ""}`}>{slots.length}</span><ChevronRight className="h-4 w-4 text-primary" /></span>
      </Link>
      <ul className="max-h-36 overflow-y-auto">
        {slots.length === 0 ? <li className="text-muted-foreground">None</li> : slots.slice(0, 50).map((s) => (
          <li key={s.id}><Link to={`/admin/roster?shift=${s.id}`} className="-mx-2 block truncate rounded px-2 py-1 text-muted-foreground hover:bg-secondary hover:text-foreground">{label(s)}</Link></li>
        ))}
      </ul>
      {slots.length > 0 && <Link to={`/admin/roster?view=${view}`} className="mt-2 inline-flex items-center text-xs font-semibold text-primary hover:underline">View all {slots.length} on the roster<ChevronRight className="h-3.5 w-3.5" /></Link>}
    </div>
  );
}
