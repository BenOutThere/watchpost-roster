// Pure roster / staffing rules shared by the dashboard, roster and tests.

export type Slot = {
  id: string;
  event_id: string;
  contractor_id: string | null;
  shift_ref: string;
  role: string;
  position: string;
  zone: string;
  scope: string;
  notes?: string | null;
  current_start: string;
  current_end: string;
  original_start?: string | null;
  original_end?: string | null;
  original_role?: string | null;
  original_position?: string | null;
  original_zone?: string | null;
  required: boolean;
  is_additional: boolean;
  assigned_guard_id: string | null;
  assigned_guard_name: string | null;
  temp_redeploy: { role?: string; position?: string; zone?: string; from?: string; until?: string; variation_ref?: string } | null;
  status: string;
  version: number;
  source_variation_id?: string | null;
};

export type Attendance = {
  id: string;
  guard_id: string;
  slot_id: string | null;
  signed_on_at: string;
  signed_off_at: string | null;
  sign_off_method?: string | null;
};

export type SlotStatus = "Filled" | "Missing" | "Upcoming" | "Completed";

export function isActiveAt(slot: Slot, now: Date) {
  const t = now.getTime();
  return slot.status === "active" && new Date(slot.current_start).getTime() <= t && t < new Date(slot.current_end).getTime();
}

export function activeAttendanceBySlot(attendance: Attendance[]) {
  const map = new Map<string, Attendance>();
  for (const a of attendance) if (!a.signed_off_at && a.slot_id) map.set(a.slot_id, a);
  return map;
}

export function slotStatus(slot: Slot, bySlot: Map<string, Attendance>, now: Date): SlotStatus {
  const t = now.getTime();
  if (new Date(slot.current_end).getTime() <= t) return "Completed";
  if (new Date(slot.current_start).getTime() > t) return "Upcoming";
  if (bySlot.has(slot.id)) return "Filled";
  return slot.required ? "Missing" : "Filled";
}

/** Effective deployment, applying any active temporary redeployment. */
export function effectiveDeployment(slot: Slot, now: Date) {
  const r = slot.temp_redeploy;
  if (r?.until) {
    const from = r.from ? new Date(r.from).getTime() : 0;
    const until = new Date(r.until).getTime();
    if (now.getTime() >= from && now.getTime() < until) {
      return { role: r.role || slot.role, position: r.position || slot.position, zone: r.zone || slot.zone, temporary: true, until: r.until };
    }
  }
  return { role: slot.role, position: slot.position, zone: slot.zone, temporary: false, until: null as string | null };
}

export function staffingMetrics(slots: Slot[], attendance: Attendance[], now: Date) {
  const bySlot = activeAttendanceBySlot(attendance);
  const active = slots.filter((s) => isActiveAt(s, now) && s.required);
  const activeIds = new Set(active.map((s) => s.id));
  const signedOn = attendance.filter((a) => !a.signed_off_at && a.slot_id && activeIds.has(a.slot_id)).length;
  const missing = active.filter((s) => !bySlot.has(s.id)).length;
  const unallocated = attendance.filter((a) => !a.signed_off_at && !a.slot_id);
  return { rostered: active.length, signedOn, missing, unallocated };
}

export function hoursBetween(start: string, end: string) {
  return Math.round(((new Date(end).getTime() - new Date(start).getTime()) / 36e5) * 100) / 100;
}

// ---------- Time zones ----------

function tzOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date);
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return asUtc - date.getTime();
}

/** Interpret "YYYY-MM-DD HH:mm" as wall-clock time in the event time zone and return an ISO string. */
export function zonedToIso(local: string, timeZone: string) {
  const m = local.trim().replace("T", " ").match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/);
  if (!m) throw new Error(`Unrecognised date/time: ${local}`);
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let ts = guess - tzOffsetMs(new Date(guess), timeZone);
  ts = guess - tzOffsetMs(new Date(ts), timeZone);
  return new Date(ts).toISOString();
}

/** Format an ISO timestamp as "YYYY-MM-DD HH:mm" in the event time zone. */
export function isoToZoned(iso: string, timeZone: string) {
  const d = new Date(new Date(iso).getTime() + tzOffsetMs(new Date(iso), timeZone));
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export function fmtTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-AU", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export function fmtDateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-AU", { timeZone, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

// ---------- CSV ----------

export function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Pass `costs` only for users allowed to see costs; otherwise cost columns are left out entirely. */
export function rosterToCsv(slots: Slot[], contractorName: (id: string | null) => string, timeZone: string, now = new Date(), costs?: Map<string, SlotCost>) {
  const header = ["Shift ID", "Contractor", "Role", "Position", "Zone", "Start", "Finish", "Hours", "Scope", "Additional scope", "Temporary redeployment", "Original start", "Original finish", "Original position", "Original zone", "Version", ...(costs ? ["Paid hours", "Hourly rate", "Cost"] : [])];
  const rows = slots.map((s) => {
    const d = effectiveDeployment(s, now);
    const c = costs?.get(s.id);
    return [
      s.shift_ref, contractorName(s.contractor_id), s.role, s.position, s.zone,
      isoToZoned(s.current_start, timeZone), isoToZoned(s.current_end, timeZone), hoursBetween(s.current_start, s.current_end),
      s.scope, s.is_additional ? "Yes" : "No",
      s.temp_redeploy?.until ? `${s.temp_redeploy.position ?? ""} / ${s.temp_redeploy.zone ?? ""} until ${isoToZoned(s.temp_redeploy.until, timeZone)}${d.temporary ? " (active)" : ""}` : "",
      s.original_start ? isoToZoned(s.original_start, timeZone) : "", s.original_end ? isoToZoned(s.original_end, timeZone) : "",
      s.original_position ?? "", s.original_zone ?? "", s.version,
      ...(costs ? (c ? [slotPaidHours(s, c), Number(c.hourly_rate), slotCost(s, c)] : ["", "", ""]) : []),
    ];
  });
  return [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
}

export function downloadText(filename: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const ROSTER_FIELDS = [
  { key: "shift_ref", label: "Shift ID", required: true, cost: false },
  { key: "contractor", label: "Security contractor", required: false, cost: false },
  { key: "role", label: "Role", required: false, cost: false },
  { key: "position", label: "Position", required: true, cost: false },
  { key: "zone", label: "Zone or location", required: false, cost: false },
  { key: "date", label: "Date", required: false, cost: false },
  { key: "start", label: "Shift start", required: true, cost: false },
  { key: "finish", label: "Shift finish", required: true, cost: false },
  { key: "count", label: "Number of guards required", required: false, cost: false },
  { key: "scope", label: "Scope description", required: false, cost: false },
  { key: "notes", label: "Notes", required: false, cost: false },
  { key: "paid_hours", label: "Paid hours", required: false, cost: true },
  { key: "hourly_rate", label: "Hourly rate", required: false, cost: true },
  { key: "total_cost", label: "Total cost", required: false, cost: true },
] as const;

export type RosterFieldKey = (typeof ROSTER_FIELDS)[number]["key"];

/** Guess column mapping from header names. */
export function guessMapping(headers: string[]): Partial<Record<RosterFieldKey, string>> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const hints: Record<RosterFieldKey, string[]> = {
    shift_ref: ["shiftid", "shift", "id", "ref", "shiftref"],
    contractor: ["contractor", "securitycontractor", "provider", "company"],
    role: ["role"],
    position: ["position", "post"],
    zone: ["zone", "location", "area"],
    date: ["date", "day"],
    start: ["start", "shiftstart", "starttime", "from"],
    finish: ["finish", "end", "shiftfinish", "endtime", "to"],
    count: ["guardsrequired", "numberofguardsrequired", "count", "qty", "required", "headcount"],
    scope: ["scope", "scopedescription", "duties"],
    notes: ["notes", "comments"],
    paid_hours: ["paidhours", "staffhours", "hours"],
    hourly_rate: ["hourlyrate", "rate", "rateperhour"],
    total_cost: ["totalcost", "cost"],
  };
  const out: Partial<Record<RosterFieldKey, string>> = {};
  for (const key of Object.keys(hints) as RosterFieldKey[]) {
    const h = headers.find((x) => hints[key].includes(norm(x)));
    if (h) out[key] = h;
  }
  return out;
}

// ---------- Costs (only shown to users allowed to see costs) ----------

export type SlotCost = { slot_id: string; hourly_rate: number; paid_hours: number | null };
export type VariationCost = { variation_id: string; hourly_rate: number; original_hours: number; proposed_hours: number; original_cost: number; proposed_cost: number; cost_delta: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Paid hours now = paid hours in the original roster + any approved change in shift length. */
export function slotPaidHours(slot: Slot, cost?: SlotCost | null) {
  const cur = hoursBetween(slot.current_start, slot.current_end);
  const orig = hoursBetween(slot.original_start ?? slot.current_start, slot.original_end ?? slot.current_end);
  const base = cost?.paid_hours != null ? Number(cost.paid_hours) : orig;
  return round2(base + (cur - orig));
}

/** Current approved cost of a position, or null when no rate is loaded. */
export function slotCost(slot: Slot, cost?: SlotCost | null) {
  if (!cost) return null;
  return round2(slotPaidHours(slot, cost) * Number(cost.hourly_rate));
}

/** Cost of the position in the original roster (0 for positions added by variations). */
export function originalSlotCost(slot: Slot, cost?: SlotCost | null) {
  if (!cost || slot.is_additional) return 0;
  const orig = hoursBetween(slot.original_start ?? slot.current_start, slot.original_end ?? slot.current_end);
  return round2((cost.paid_hours != null ? Number(cost.paid_hours) : orig) * Number(cost.hourly_rate));
}

export function rosterCostTotals(slots: Slot[], costs: Map<string, SlotCost>) {
  let original = 0, current = 0;
  for (const s of slots) {
    const c = costs.get(s.id);
    if (!c) continue;
    original += originalSlotCost(s, c);
    if (s.status === "active") current += slotCost(s, c) ?? 0;
  }
  return { original: round2(original), current: round2(current), variance: round2(current - original) };
}

/** Cost change of a proposed new start/finish on an existing position. */
export function timeChangeDelta(slot: Slot, cost: SlotCost | null | undefined, newStart: string, newEnd: string) {
  if (!cost) return null;
  return round2((hoursBetween(newStart, newEnd) - hoursBetween(slot.current_start, slot.current_end)) * Number(cost.hourly_rate));
}

/** Most common rate for a role in this roster — used to price additional guards. */
export function suggestedRate(slots: Slot[], costs: Map<string, SlotCost>, role: string) {
  const tally = (match: (s: Slot) => boolean) => {
    const counts = new Map<number, number>();
    for (const s of slots) { const c = costs.get(s.id); if (c && match(s)) counts.set(Number(c.hourly_rate), (counts.get(Number(c.hourly_rate)) ?? 0) + 1); }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const r = role.trim().toLowerCase();
  return tally((s) => s.role.trim().toLowerCase() === r) ?? tally(() => true) ?? 0;
}

export const fmtAUD = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n));
export const fmtDelta = (n: number | null | undefined) => (n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtAUD(Math.abs(n))}`);

/** Combine a date column and a time column into "YYYY-MM-DD HH:mm". Handles overnight finish. */
export function combineDateTime(date: string | undefined, time: string) {
  const t = String(time ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.replace("T", " ").slice(0, 16);
  const dm = String(date ?? "").trim();
  let iso = dm;
  const au = dm.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (au) iso = `${au[3].length === 2 ? "20" + au[3] : au[3]}-${au[2].padStart(2, "0")}-${au[1].padStart(2, "0")}`;
  const tm = t.match(/^(\d{1,2})[:.]?(\d{2})?(?::\d{2})?\s*(am|pm)?$/i);
  if (tm) {
    let h = parseInt(tm[1], 10);
    const ap = tm[3]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    tm[1] = String(h); tm[2] = tm[2] ?? "00";
  }
  if (!iso || !tm) throw new Error(`Cannot read date/time "${date} ${time}"`);
  return `${iso} ${tm[1].padStart(2, "0")}:${tm[2]}`;
}

export function addDay(local: string) {
  const d = new Date(local.replace(" ", "T") + ":00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 16).replace("T", " ");
}

// ---------- User types and permissions ----------
// Each user has one user type (a role in user_roles). Access is ticked per user type (role_permissions),
// so everyone of the same type has the same access. Super Admin always has everything.
// The database mirrors this in has_permission(). `defaults` below are the starting ticks for "Reset to usual access".

export const PERMISSIONS = [
  { key: "view_dashboard", label: "Dashboard", group: "view" },
  { key: "view_roster", label: "Roster", group: "view" },
  { key: "view_costs", label: "Costs & rates", group: "view" },
  { key: "view_variations", label: "Variations", group: "view" },
  { key: "view_guards", label: "Guards", group: "view" },
  { key: "view_sign_in", label: "Sign-in desk", group: "view" },
  { key: "view_communications", label: "Communications", group: "view" },
  { key: "view_locations", label: "Live Map (guard locations)", group: "view" },
  { key: "view_settings", label: "Settings", group: "view" },
  { key: "request_variations", label: "Request variations", group: "do" },
  { key: "acknowledge_variations", label: "Acknowledge variations", group: "do" },
  { key: "approve_variations", label: "Approve variations", group: "do" },
  { key: "sign_on_guards", label: "Sign guards on to positions", group: "do" },
  { key: "add_provider_users", label: "Add security provider users", group: "do" },
  { key: "manage_sms", label: "Set up event SMS (Tall Bob)", group: "do" },
] as const;
export type Permission = (typeof PERMISSIONS)[number]["key"];

export type UserType = { role: string; label: string; security: boolean; defaults: Permission[] };

/** The seven user types. Security types belong to a contracted security provider and only see that provider's shifts and guards. */
export const USER_TYPES: UserType[] = [
  { role: "super_admin", label: "Super Admin", security: false, defaults: PERMISSIONS.map((p) => p.key) },
  { role: "senior_management", label: "Senior Management", security: false, defaults: ["view_locations", "view_dashboard", "view_roster", "view_costs", "view_variations", "view_guards", "view_communications", "request_variations", "approve_variations"] },
  { role: "event_manager", label: "Event Manager", security: false, defaults: ["view_locations", "view_dashboard", "view_roster", "view_variations", "view_guards", "view_sign_in", "view_communications", "view_settings", "request_variations"] },
  { role: "event_control_assistant", label: "Event Control Assistant", security: false, defaults: ["view_locations", "view_dashboard", "view_roster", "view_variations", "view_guards"] },
  { role: "security_manager", label: "Security Manager", security: true, defaults: ["view_locations", "view_dashboard", "view_roster", "view_variations", "view_guards", "view_sign_in", "view_communications", "request_variations", "acknowledge_variations", "sign_on_guards", "add_provider_users"] },
  { role: "security_zone_manager", label: "Security Zone Manager", security: true, defaults: ["view_locations", "view_dashboard", "view_roster", "view_variations", "view_guards", "request_variations"] },
  { role: "security_sign_in", label: "Security Sign In", security: true, defaults: ["view_sign_in", "sign_on_guards"] },
];

export const userTypeOf = (role: string) => USER_TYPES.find((t) => t.role === role);
export const SECURITY_USER_TYPES = USER_TYPES.filter((t) => t.security).map((t) => t.role);

/**
 * May this person remove another user's account? Nobody removes themselves. A Super Admin (outside the
 * Security Manager preview) may remove anyone; anyone ticked "Add security provider users" may only remove
 * security provider users of their own provider(s). Mirrors the delete-user function.
 */
export function canRemoveUser(opts: {
  actorId: string; actorRoles: string[]; actorPermissions: string[]; actorContractorIds: string[]; securityView?: boolean;
  targetId: string; targetRole: string; targetContractorIds: string[];
}): boolean {
  const { actorId, actorRoles, actorPermissions, actorContractorIds, securityView = false, targetId, targetRole, targetContractorIds } = opts;
  if (!actorId || actorId === targetId) return false;
  const isSuper = actorRoles.includes("super_admin");
  if (isSuper && !securityView) return true;
  if (!hasPermission(actorRoles, actorPermissions, "add_provider_users")) return false;
  if (!SECURITY_USER_TYPES.includes(targetRole)) return false;
  if (isSuper) return true;
  return targetContractorIds.length > 0 && targetContractorIds.every((c) => actorContractorIds.includes(c));
}

/**
 * User types this person may add. A Super Admin (outside the Security Manager preview) may add any type;
 * anyone ticked "Add security provider users" may only add security provider types. Mirrors the create-user function.
 */
export function addableUserTypes(roles: string[], permissions: string[], securityView = false): string[] {
  if (roles.includes("super_admin") && !securityView) return USER_TYPES.map((t) => t.role);
  if (hasPermission(roles, permissions, "add_provider_users")) return SECURITY_USER_TYPES;
  return [];
}

export function hasPermission(roles: string[], permissions: string[], p: Permission) {
  return roles.includes("super_admin") || permissions.includes(p);
}

/** May approve variations. Mirrors can_approve_variations() in the database. */
export function canApproveVariations(roles: string[], permissions: string[] = []) {
  return hasPermission(roles, permissions, "approve_variations");
}

/** Only a Super Admin may upload a roster. Mirrors the database rule (reset_event_roster and roster_slots policy). */
export function canUploadRoster(roles: string[]) {
  return roles.includes("super_admin");
}

// ---------- Multi-shift variation requests ----------

/** Move a shift's start and finish by a number of minutes (negative = earlier). Used when one request changes many shifts. */
export function adjustShiftTimes(slot: Pick<Slot, "current_start" | "current_end">, startByMin: number, endByMin: number) {
  const start = new Date(new Date(slot.current_start).getTime() + startByMin * 60000).toISOString();
  const end = new Date(new Date(slot.current_end).getTime() + endByMin * 60000).toISOString();
  return { start, end };
}

/** Shifts submitted together share a group_id; a single-shift request is its own group. */
export function requestKey(v: { id: string; group_id?: string | null }) {
  return v.group_id ?? v.id;
}

/** Overall status of a request covering several shifts: the stage still waiting on someone wins, otherwise the decision. */
export function requestStatus(statuses: string[]) {
  for (const s of ["returned", "awaiting_ack", "requested", "awaiting_approval"]) if (statuses.includes(s)) return s;
  return statuses.includes("approved") ? "approved" : statuses[0] ?? "declined";
}

/** Bundle variation rows into requests, keeping the order of the input (newest first in the app). */
export function groupVariations<T extends { id: string; group_id?: string | null }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = requestKey(r);
    const list = map.get(k);
    if (list) list.push(r); else map.set(k, [r]);
  }
  return [...map.values()];
}

// ---------------- Roster quick filters & cross-page links ----------------

export type RosterView = "all" | "live" | "vacant" | "soon" | "ending" | "changed" | "pending" | "finished";
/** "Starting soon" and "finishing soon" look this many hours ahead (matches the dashboard tiles). */
export const SOON_HOURS = 1;
const PENDING_VARIATION = ["awaiting_ack", "requested", "awaiting_approval", "returned"];

/** Shift ids that have a variation still waiting to be acknowledged, approved or clarified. */
export function pendingVariationSlotIds(variations: { slot_id: string | null; status: string }[]) {
  return new Set(variations.filter((v) => v.slot_id && PENDING_VARIATION.includes(v.status)).map((v) => v.slot_id!));
}

/** Does a shift belong in a roster quick-filter tab? */
export function matchesRosterView(view: RosterView, slot: Slot, bySlot: Map<string, Attendance>, now: Date, pending: Set<string>) {
  const t = now.getTime();
  const start = new Date(slot.current_start).getTime();
  switch (view) {
    case "live": return isActiveAt(slot, now);
    case "vacant": return slot.status === "active" && slotStatus(slot, bySlot, now) === "Missing";
    case "soon": return slot.status === "active" && start > t && start <= t + SOON_HOURS * 36e5;
    case "ending": return isActiveAt(slot, now) && new Date(slot.current_end).getTime() <= t + SOON_HOURS * 36e5;
    case "changed": return slot.version > 1 || !!slot.is_additional;
    case "pending": return pending.has(slot.id);
    case "finished": return new Date(slot.current_end).getTime() <= t;
    default: return true;
  }
}

/** Smallest Sign-in desk "starting within" window (hours) that still lists a shift starting at `startIso`. */
export function signInWindowFor(startIso: string, now: Date) {
  const h = (new Date(startIso).getTime() - now.getTime()) / 36e5;
  for (const w of [1, 2, 4, 8, 24]) if (h <= w) return w;
  return Math.ceil(h);
}

// ---------------- Variation export ----------------

type ExportVariation = {
  id: string; ref: string; variation_type: string; slot_id: string | null; group_id?: string | null; contractor_id: string | null;
  original: Record<string, any>; proposed: Record<string, any>; reason: string; notes: string | null; requested_by_name: string; status: string;
  ack_by_name: string | null; ack_at: string | null; ack_comments: string | null; approved_by_name: string | null; approved_at: string | null;
  decision_notes: string | null; applied_at: string | null; created_at: string;
};

/**
 * One CSV row per shift in each variation request (multi-shift requests share the "Request" column).
 * Pass `costs` only for users allowed to see costs; otherwise cost columns are left out entirely.
 */
export function variationsToCsv(
  rows: ExportVariation[],
  opts: { timeZone: string; shiftRef: (slotId: string | null) => string; contractorName: (id: string | null) => string; typeLabel: (t: string) => string; statusLabel: (s: string) => string; costs?: Map<string, VariationCost> },
) {
  const tz = opts.timeZone;
  const t = (iso: unknown) => (typeof iso === "string" && iso ? isoToZoned(iso, tz) : "");
  const groups = new Map<string, ExportVariation[]>();
  for (const v of rows) { const k = requestKey(v); groups.set(k, [...(groups.get(k) ?? []), v]); }
  const header = [
    "Variation ID", "Request", "Shifts in request", "Type", "Status", "Shift ID", "Contractor",
    "Original start", "Original finish", "Original hours", "New start", "New finish", "New hours",
    "Original role", "Original position", "Original zone", "New role", "New position", "New zone", "Temporary until", "Additional guards",
    "Reason", "Notes", "Requested by", "Requested at", "Acknowledged by", "Acknowledged at", "Acknowledgement comments",
    "Decided by", "Decided at", "Decision notes", "Applied to roster at",
    ...(opts.costs ? ["Hourly rate", "Original cost", "New cost", "Cost change"] : []),
  ];
  const body = rows.map((v) => {
    const group = groups.get(requestKey(v)) ?? [v];
    const o = v.original ?? {}, p = v.proposed ?? {};
    const c = opts.costs?.get(v.id);
    const decided = ["approved", "declined", "returned"].includes(v.status);
    return [
      v.ref, group[0].ref, group.length, opts.typeLabel(v.variation_type), opts.statusLabel(v.status),
      v.slot_id ? opts.shiftRef(v.slot_id) : "New shift", opts.contractorName(v.contractor_id),
      t(o.start), t(o.end), o.hours ?? "", t(p.start), t(p.end), p.hours ?? "",
      o.role ?? "", o.position ?? "", o.zone ?? "",
      v.variation_type === "time" ? "" : p.role ?? "", v.variation_type === "time" ? "" : p.position ?? "", v.variation_type === "time" ? "" : p.zone ?? "",
      t(p.until), p.count ?? "",
      v.reason, v.notes ?? "", v.requested_by_name, t(v.created_at), v.ack_by_name ?? "", t(v.ack_at), v.ack_comments ?? "",
      decided ? v.approved_by_name ?? "" : "", decided ? t(v.approved_at) : "", v.decision_notes ?? "", t(v.applied_at),
      ...(opts.costs ? (c ? [Number(c.hourly_rate), Number(c.original_cost), Number(c.proposed_cost), Number(c.cost_delta)] : ["", "", "", ""]) : []),
    ];
  });
  return [header, ...body].map((r) => r.map(csvEscape).join(",")).join("\n");
}

/** A guard can delete their own account from the phone, but not while signed on to a shift. Mirrors delete-my-account. */
export function canDeleteOwnAccount(opts: { isGuard: boolean; signedOn: boolean }): boolean {
  return opts.isGuard && !opts.signedOn;
}

/** The guard must type DELETE (any case, surrounding spaces ignored) to confirm. */
export function isDeleteConfirmation(text: string): boolean {
  return text.trim().toUpperCase() === "DELETE";
}
