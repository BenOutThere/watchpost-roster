import { describe, expect, it } from "vitest";
import { staffingMetrics, slotStatus, activeAttendanceBySlot, zonedToIso, isoToZoned, effectiveDeployment, combineDateTime, slotCost, slotPaidHours, originalSlotCost, rosterCostTotals, timeChangeDelta, suggestedRate, canApproveVariations, USER_TYPES, addableUserTypes, canRemoveUser, canDeleteOwnAccount, isDeleteConfirmation, canUploadRoster, adjustShiftTimes, groupVariations, requestStatus, matchesRosterView, pendingVariationSlotIds, signInWindowFor, variationsToCsv, type Slot, type Attendance } from "./roster";

const now = new Date("2026-10-20T05:00:00Z");
const slot = (id: string, start: string, end: string, extra: Partial<Slot> = {}): Slot => ({
  id, event_id: "e", contractor_id: "c", shift_ref: id, role: "Crowd", position: "Gate " + id, zone: "A", scope: "",
  current_start: start, current_end: end, required: true, is_additional: false, assigned_guard_id: null, assigned_guard_name: null,
  temp_redeploy: null, status: "active", version: 1, ...extra,
});
const att = (id: string, slot_id: string | null, off: string | null = null): Attendance => ({ id, guard_id: "g" + id, slot_id, signed_on_at: "2026-10-20T03:00:00Z", signed_off_at: off });

describe("staffing rules", () => {
  const slots = [
    slot("1", "2026-10-20T03:00:00Z", "2026-10-20T11:00:00Z"),
    slot("2", "2026-10-20T03:00:00Z", "2026-10-20T11:00:00Z"),
    slot("3", "2026-10-20T03:00:00Z", "2026-10-20T11:00:00Z"),
    slot("4", "2026-10-20T07:00:00Z", "2026-10-20T11:00:00Z"),
  ];

  it("counts a position as missing when start has passed and no guard is signed on", () => {
    const m = staffingMetrics(slots, [att("a", "1")], now);
    expect(m.rostered).toBe(3);
    expect(m.signedOn).toBe(1);
    expect(m.missing).toBe(2);
  });

  it("never counts an unallocated guard as filling a position", () => {
    const m = staffingMetrics(slots, [att("a", "1"), att("b", null), att("c", null)], now);
    expect(m.missing).toBe(2);
    expect(m.signedOn).toBe(1);
    expect(m.unallocated).toHaveLength(2);
  });

  it("ignores signed-off guards", () => {
    const m = staffingMetrics(slots, [att("a", "1", "2026-10-20T04:00:00Z")], now);
    expect(m.missing).toBe(3);
  });

  it("marks future positions as upcoming and finished ones as completed", () => {
    const map = activeAttendanceBySlot([]);
    expect(slotStatus(slots[3], map, now)).toBe("Upcoming");
    expect(slotStatus(slot("x", "2026-10-20T00:00:00Z", "2026-10-20T04:00:00Z"), map, now)).toBe("Completed");
  });

  it("an extended shift remains active past its original finish", () => {
    const extended = slot("e", "2026-10-20T00:00:00Z", "2026-10-20T06:00:00Z", { original_end: "2026-10-20T04:00:00Z" });
    expect(staffingMetrics([extended], [], now).rostered).toBe(1);
  });
});

describe("time zones", () => {
  it("reads roster times in the event's time zone (Sydney, daylight saving)", () => {
    expect(zonedToIso("2026-10-20 14:00", "Australia/Sydney")).toBe("2026-10-20T03:00:00.000Z");
    expect(isoToZoned("2026-10-20T03:00:00.000Z", "Australia/Sydney")).toBe("2026-10-20 14:00");
  });
});

describe("temporary redeployment", () => {
  it("applies only inside the approved period", () => {
    const s = slot("r", "2026-10-20T03:00:00Z", "2026-10-20T11:00:00Z", { temp_redeploy: { position: "Main Arena", zone: "B", from: "2026-10-20T04:00:00Z", until: "2026-10-20T06:00:00Z" } });
    expect(effectiveDeployment(s, now).position).toBe("Main Arena");
    expect(effectiveDeployment(s, new Date("2026-10-20T07:00:00Z")).position).toBe("Gate r");
  });
});

describe("roster costs", () => {
  // Braddon supervisor: 16:00–23:30 (7.5 h on the clock) but paid 8 h at $85 = $680 in the original roster.
  const base = slot("B1", "2026-01-08T05:00:00Z", "2026-01-08T12:30:00Z", { original_start: "2026-01-08T05:00:00Z", original_end: "2026-01-08T12:30:00Z" });
  const cost = { slot_id: "B1", hourly_rate: 85, paid_hours: 8 };

  it("uses the paid hours from the uploaded roster for the original cost", () => {
    expect(originalSlotCost(base, cost)).toBe(680);
    expect(slotCost(base, cost)).toBe(680);
  });

  it("adds an approved 1 hour extension at the shift's hourly rate", () => {
    const extended = { ...base, current_end: "2026-01-08T13:30:00Z" };
    expect(slotPaidHours(extended, cost)).toBe(9);
    expect(slotCost(extended, cost)).toBe(765);
    expect(originalSlotCost(extended, cost)).toBe(680);
  });

  it("prices a proposed change before approval", () => {
    expect(timeChangeDelta(base, cost, "2026-01-08T05:00:00Z", "2026-01-08T11:30:00Z")).toBe(-85);
  });

  it("counts positions added by variations only in the current cost", () => {
    const extra = slot("X1", "2026-01-08T05:00:00Z", "2026-01-08T09:00:00Z", { is_additional: true });
    const costs = new Map([["B1", cost], ["X1", { slot_id: "X1", hourly_rate: 75, paid_hours: null }]]);
    expect(rosterCostTotals([base, extra], costs)).toEqual({ original: 680, current: 980, variance: 300 });
  });

  it("suggests the most common rate for the role when adding guards", () => {
    const a = slot("a", "2026-01-08T05:00:00Z", "2026-01-08T09:00:00Z", { role: "Security Guard" });
    const b = slot("b", "2026-01-08T05:00:00Z", "2026-01-08T09:00:00Z", { role: "Security Guard" });
    const costs = new Map([["a", { slot_id: "a", hourly_rate: 75, paid_hours: null }], ["b", { slot_id: "b", hourly_rate: 75, paid_hours: null }], ["B1", cost]]);
    expect(suggestedRate([a, b, base], costs, "security guard")).toBe(75);
    expect(suggestedRate([a, b, base], costs, "Crowd")).toBe(85);
    expect(suggestedRate([a, b, base], costs, "Dog handler")).toBe(75);
  });
});

describe("reading uploaded dates and times", () => {
  it("reads ISO dates, Australian day/month dates and am/pm times", () => {
    expect(combineDateTime("2026-01-08", "16:00")).toBe("2026-01-08 16:00");
    expect(combineDateTime("8/1/2026", "4:30 pm")).toBe("2026-01-08 16:30");
    expect(combineDateTime("8/1/26", "11:00am")).toBe("2026-01-08 11:00");
    expect(combineDateTime("2026-01-09", "07:15:00")).toBe("2026-01-09 07:15");
  });
});

describe("variation approval", () => {
  const defaults = (role: string) => USER_TYPES.find((t) => t.role === role)!.defaults as string[];
  it("Senior Management approves variations by default", () => {
    expect(canApproveVariations(["senior_management"], defaults("senior_management"))).toBe(true);
  });
  it("Security Manager acknowledges but does not approve by default", () => {
    expect(canApproveVariations(["security_manager"], defaults("security_manager"))).toBe(false);
    expect(defaults("security_manager")).toContain("acknowledge_variations");
  });
  it("Super Admin can always approve", () => {
    expect(canApproveVariations(["super_admin"], [])).toBe(true);
  });
  it("a ticked permission grants approval, an unticked one does not", () => {
    expect(canApproveVariations(["event_manager"], ["approve_variations"])).toBe(true);
    expect(canApproveVariations(["event_manager"], [])).toBe(false);
  });
  it("only Super Admin and Senior Management see costs by default", () => {
    expect(USER_TYPES.filter((t) => t.defaults.includes("view_costs")).map((t) => t.role)).toEqual(["super_admin", "senior_management"]);
  });
  it("all three Security user types belong to a security provider", () => {
    expect(USER_TYPES.filter((t) => t.security).map((t) => t.role)).toEqual(["security_manager", "security_zone_manager", "security_sign_in"]);
  });
});

describe("adding users", () => {
  const defaults = (role: string) => USER_TYPES.find((t) => t.role === role)!.defaults as string[];
  it("a Super Admin can add every user type", () => {
    expect(addableUserTypes(["super_admin"], [])).toHaveLength(7);
  });
  it("a Security Manager can only add security provider user types", () => {
    expect(addableUserTypes(["security_manager"], defaults("security_manager"))).toEqual(["security_manager", "security_zone_manager", "security_sign_in"]);
  });
  it("the Security Manager preview limits a Super Admin to security provider user types", () => {
    expect(addableUserTypes(["super_admin"], [], true)).toEqual(["security_manager", "security_zone_manager", "security_sign_in"]);
  });
  it("other user types can't add users by default", () => {
    expect(addableUserTypes(["event_manager"], defaults("event_manager"))).toEqual([]);
    expect(addableUserTypes(["security_zone_manager"], defaults("security_zone_manager"))).toEqual([]);
  });
});

describe("roster upload", () => {
  it("only lets a Super Admin upload a roster", () => {
    expect(canUploadRoster(["super_admin"])).toBe(true);
    expect(canUploadRoster(["operations_manager"])).toBe(false);
    expect(canUploadRoster(["security_manager"])).toBe(false);
    expect(canUploadRoster(["event_manager", "contractor_manager"])).toBe(false);
  });
});

describe("multi-shift variation requests", () => {
  it("moves each shift's finish by the same amount", () => {
    expect(adjustShiftTimes({ current_start: "2026-10-20T03:00:00Z", current_end: "2026-10-20T11:00:00Z" }, 0, 60)).toEqual({ start: "2026-10-20T03:00:00.000Z", end: "2026-10-20T12:00:00.000Z" });
    expect(adjustShiftTimes({ current_start: "2026-10-20T05:00:00Z", current_end: "2026-10-20T13:00:00Z" }, -30, -30)).toEqual({ start: "2026-10-20T04:30:00.000Z", end: "2026-10-20T12:30:00.000Z" });
  });
  it("bundles shifts submitted together into one request", () => {
    const groups = groupVariations([{ id: "a", group_id: "g" }, { id: "b", group_id: null }, { id: "c", group_id: "g" }]);
    expect(groups.map((g) => g.map((v) => v.id))).toEqual([["a", "c"], ["b"]]);
  });
  it("shows a request as waiting while any shift in it is still waiting", () => {
    expect(requestStatus(["approved", "awaiting_approval"])).toBe("awaiting_approval");
    expect(requestStatus(["awaiting_approval", "awaiting_ack"])).toBe("awaiting_ack");
    expect(requestStatus(["approved", "declined"])).toBe("approved");
  });
});

describe("roster quick filters", () => {
  const live = slot("L", "2026-10-20T03:00:00Z", "2026-10-20T11:00:00Z");
  const soon = slot("S", "2026-10-20T05:45:00Z", "2026-10-20T12:00:00Z");
  const later = slot("T", "2026-10-20T06:30:00Z", "2026-10-20T12:00:00Z");
  const ending = slot("E", "2026-10-20T01:00:00Z", "2026-10-20T05:40:00Z");
  const done = slot("D", "2026-10-20T00:00:00Z", "2026-10-20T04:00:00Z", { version: 2 });
  const bySlot = activeAttendanceBySlot([]);
  const none = new Set<string>();

  it("lists a started shift with nobody signed on as vacant, and not once a guard signs on", () => {
    expect(matchesRosterView("vacant", live, bySlot, now, none)).toBe(true);
    expect(matchesRosterView("vacant", live, activeAttendanceBySlot([att("a", "L")]), now, none)).toBe(false);
  });

  it("treats 'finishing soon' as a live shift ending within the next hour", () => {
    expect(matchesRosterView("ending", ending, bySlot, now, none)).toBe(true);
    expect(matchesRosterView("ending", live, bySlot, now, none)).toBe(false);
    expect(matchesRosterView("ending", done, bySlot, now, none)).toBe(false);
  });

  it("treats 'starting soon' as starting within the next hour", () => {
    expect(matchesRosterView("soon", soon, bySlot, now, none)).toBe(true);
    expect(matchesRosterView("soon", later, bySlot, now, none)).toBe(false);
    expect(matchesRosterView("soon", live, bySlot, now, none)).toBe(false);
  });

  it("marks varied shifts as changed and past shifts as finished", () => {
    expect(matchesRosterView("changed", done, bySlot, now, none)).toBe(true);
    expect(matchesRosterView("changed", live, bySlot, now, none)).toBe(false);
    expect(matchesRosterView("finished", done, bySlot, now, none)).toBe(true);
  });

  it("flags shifts with a variation still awaiting acknowledgement or approval", () => {
    const pending = pendingVariationSlotIds([{ slot_id: "L", status: "awaiting_ack" }, { slot_id: "S", status: "approved" }, { slot_id: "T", status: "awaiting_approval" }]);
    expect([...pending].sort()).toEqual(["L", "T"]);
    expect(matchesRosterView("pending", soon, bySlot, now, pending)).toBe(false);
  });

  it("opens the Sign-in desk with a window wide enough to list the shift", () => {
    expect(signInWindowFor("2026-10-20T06:30:00Z", now)).toBe(2);
    expect(signInWindowFor("2026-10-20T04:00:00Z", now)).toBe(1);
    expect(signInWindowFor("2026-10-22T05:00:00Z", now)).toBe(48);
  });
});

describe("variationsToCsv", () => {
  const v = (id: string, ref: string, group_id: string | null, status = "approved") => ({
    id, ref, group_id, variation_type: "time", slot_id: "s1", contractor_id: "c1", status,
    original: { start: "2026-10-20T08:00:00Z", end: "2026-10-20T16:00:00Z", hours: 8 },
    proposed: { start: "2026-10-20T08:00:00Z", end: "2026-10-20T18:00:00Z", hours: 10 },
    reason: "Crowd stayed late, extended", notes: null, requested_by_name: "Sam", ack_by_name: "Kim", ack_at: "2026-10-20T07:00:00Z", ack_comments: null,
    approved_by_name: "Lee", approved_at: "2026-10-20T07:30:00Z", decision_notes: null, applied_at: "2026-10-20T07:30:00Z", created_at: "2026-10-20T06:00:00Z",
  });
  const opts = { timeZone: "Australia/Sydney", shiftRef: () => "SH-1", contractorName: () => "NSRG", typeLabel: (t: string) => t, statusLabel: (s: string) => s };
  const costs = new Map([["a", { variation_id: "a", hourly_rate: 50, original_hours: 8, proposed_hours: 10, original_cost: 400, proposed_cost: 500, cost_delta: 100 }]]);

  it("leaves out every cost column when costs aren't passed", () => {
    const csv = variationsToCsv([v("a", "VAR-1", null)], opts);
    expect(csv).not.toMatch(/Hourly rate|Cost change|500/);
  });

  it("includes rate and cost change for cost viewers", () => {
    const [head, row] = variationsToCsv([v("a", "VAR-1", null)], { ...opts, costs }).split("\n");
    expect(head.endsWith("Hourly rate,Original cost,New cost,Cost change")).toBe(true);
    expect(row.endsWith("50,400,500,100")).toBe(true);
  });

  it("writes one row per shift and labels multi-shift requests with a shared request ID", () => {
    const rows = variationsToCsv([v("a", "VAR-2", "g"), v("b", "VAR-1", "g"), v("c", "VAR-3", null)], opts).split("\n").slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0].startsWith("VAR-2,VAR-2,2,")).toBe(true);
    expect(rows[1].startsWith("VAR-1,VAR-2,2,")).toBe(true);
    expect(rows[2].startsWith("VAR-3,VAR-3,1,")).toBe(true);
  });

  it("shows times in the event time zone", () => {
    const row = variationsToCsv([v("a", "VAR-1", null)], opts).split("\n")[1];
    expect(row).toContain("2026-10-21 05:00"); // 18:00Z new finish = 5am Sydney
  });
});

describe("removing users", () => {
  const defaults = (role: string) => USER_TYPES.find((t) => t.role === role)!.defaults as string[];
  const base = { actorId: "me", actorContractorIds: ["c1"], targetId: "them", targetContractorIds: ["c1"] };
  it("a Super Admin can remove any other user, including another Super Admin", () => {
    expect(canRemoveUser({ ...base, actorRoles: ["super_admin"], actorPermissions: [], targetRole: "super_admin", targetContractorIds: [] })).toBe(true);
    expect(canRemoveUser({ ...base, actorRoles: ["super_admin"], actorPermissions: [], targetRole: "senior_management", targetContractorIds: [] })).toBe(true);
  });
  it("nobody can remove themselves", () => {
    expect(canRemoveUser({ ...base, targetId: "me", actorRoles: ["super_admin"], actorPermissions: [], targetRole: "super_admin" })).toBe(false);
  });
  it("a Security Manager can remove security users of their own provider only", () => {
    const sm = { ...base, actorRoles: ["security_manager"], actorPermissions: defaults("security_manager") };
    expect(canRemoveUser({ ...sm, targetRole: "security_sign_in" })).toBe(true);
    expect(canRemoveUser({ ...sm, targetRole: "security_manager" })).toBe(true);
    expect(canRemoveUser({ ...sm, targetRole: "security_sign_in", targetContractorIds: ["c2"] })).toBe(false);
    expect(canRemoveUser({ ...sm, targetRole: "event_manager", targetContractorIds: [] })).toBe(false);
  });
  it("other user types can't remove users by default", () => {
    expect(canRemoveUser({ ...base, actorRoles: ["event_manager"], actorPermissions: defaults("event_manager"), targetRole: "security_sign_in" })).toBe(false);
    expect(canRemoveUser({ ...base, actorRoles: ["security_zone_manager"], actorPermissions: defaults("security_zone_manager"), targetRole: "security_sign_in" })).toBe(false);
  });
  it("the Security Manager preview limits a Super Admin to security provider users", () => {
    expect(canRemoveUser({ ...base, actorRoles: ["super_admin"], actorPermissions: [], securityView: true, targetRole: "event_manager", targetContractorIds: [] })).toBe(false);
    expect(canRemoveUser({ ...base, actorRoles: ["super_admin"], actorPermissions: [], securityView: true, targetRole: "security_sign_in", targetContractorIds: ["c9"] })).toBe(true);
  });
});

describe("guard deletes own account", () => {
  it("is allowed for a guard who isn't signed on", () => {
    expect(canDeleteOwnAccount({ isGuard: true, signedOn: false })).toBe(true);
  });
  it("is refused while the guard is signed on to a shift", () => {
    expect(canDeleteOwnAccount({ isGuard: true, signedOn: true })).toBe(false);
  });
  it("is refused for staff accounts (removed by an administrator)", () => {
    expect(canDeleteOwnAccount({ isGuard: false, signedOn: false })).toBe(false);
  });
  it("needs the word DELETE typed to confirm", () => {
    expect(isDeleteConfirmation(" delete ")).toBe(true);
    expect(isDeleteConfirmation("del")).toBe(false);
    expect(isDeleteConfirmation("")).toBe(false);
  });
});
