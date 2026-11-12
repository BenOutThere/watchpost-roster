import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Attendance, Slot, SlotCost, VariationCost } from "@/lib/roster";
import { SECURITY_USER_TYPES, canApproveVariations, hasPermission, type Permission } from "@/lib/roster";

export type EventRow = { id: string; name: string; venue: string; timezone: string; event_date: string | null; gps_required: boolean; venue_lat: number | null; venue_lng: number | null; venue_radius_m: number; status: string };
export type Contractor = { id: string; name: string; contact_name: string | null; phone: string | null; email: string | null };
export type Guard = { id: string; name: string; phone: string; email: string; employee_id: string; licence_number: string; contractor_id: string | null; status: string; user_id: string };
export type Variation = {
  id: string; ref: string; event_id: string; contractor_id: string | null; variation_type: "time" | "redeploy" | "additional"; slot_id: string | null; group_id: string | null;
  original: Record<string, any>; proposed: Record<string, any>; reason: string; notes: string | null; requested_by_name: string; status: string;
  ack_by_name: string | null; ack_at: string | null; ack_comments: string | null; approved_by_name: string | null; approved_at: string | null; decision_notes: string | null; applied_at: string | null; created_at: string;
};
export type ViewMode = "admin" | "security";

/** Roles that may see roster costs and rates. The database enforces the same rule (can_view_costs). */
/** Event-wide user types: they see every contractor. Security user types only see their own provider. */
const MANAGER_ROLES = ["super_admin", "operations_manager", "site_supervisor", "event_manager", "senior_management", "event_control_assistant"];

type Ctx = {
  session: Session | null;
  roles: string[];
  permissions: string[];
  /** The user has this ticked permission (Super Admin has all). */
  can: (p: Permission) => boolean;
  isManager: boolean;
  /** May approve variations right now (never Security Managers, nor admins previewing the Security Manager view). */
  canApprove: boolean;
  /** The account is allowed to see costs. */
  canViewCosts: boolean;
  /** Costs are visible on screen right now (allowed and not previewing the Security Manager view). */
  showCosts: boolean;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  myContractorIds: string[];
  events: EventRow[];
  event: EventRow | null;
  setEventId: (id: string) => void;
  contractors: Contractor[];
  guards: Guard[];
  slots: Slot[];
  slotCosts: Map<string, SlotCost>;
  variationCosts: Map<string, VariationCost>;
  attendance: (Attendance & { event_id: string | null })[];
  variations: Variation[];
  loading: boolean;
  reload: () => Promise<void>;
  contractorName: (id: string | null) => string;
  guardName: (id: string | null) => string;
  now: Date;
};

const OpsCtx = createContext<Ctx | null>(null);

/** The API returns at most 1000 rows per request, so page through larger tables. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; from < 50000; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < size) break;
  }
  return out;
}

export function OpsProvider({ session, children }: { session: Session | null; children: React.ReactNode }) {
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [myContractorIds, setMyContractorIds] = useState<string[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventIdState] = useState<string | null>(() => localStorage.getItem("ops-event-id"));
  const [viewMode, setViewModeState] = useState<ViewMode>(() => (localStorage.getItem("ops-view") === "security" ? "security" : "admin"));
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotCosts, setSlotCosts] = useState<Map<string, SlotCost>>(new Map());
  const [variationCosts, setVariationCosts] = useState<Map<string, VariationCost>>(new Map());
  const [attendance, setAttendance] = useState<Ctx["attendance"]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const setEventId = (id: string) => { localStorage.setItem("ops-event-id", id); setEventIdState(id); };
  const setViewMode = (m: ViewMode) => { localStorage.setItem("ops-view", m); setViewModeState(m); };

  const event = useMemo(() => events.find((e) => e.id === eventId) ?? events[0] ?? null, [events, eventId]);
  const canViewCosts = hasPermission(roles, permissions, "view_costs");

  const loadBase = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    const [r, p, m, e, c, g] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("role_permissions").select("role,permission"),
      supabase.from("contractor_members").select("contractor_id").eq("user_id", uid),
      supabase.from("events").select("*").order("created_at", { ascending: false }),
      supabase.from("contractors").select("*").order("name"),
      fetchAll<Guard>((from, to) => supabase.from("guards").select("id,name,phone,email,employee_id,licence_number,contractor_id,status,user_id").order("name").range(from, to)),
    ]);
    const myRoles = (r.data ?? []).map((x: any) => x.role as string);
    setRoles(myRoles);
    // Access comes from the user's type: every permission ticked for that type in Settings.
    setPermissions([...new Set((p.data ?? []).filter((x: any) => myRoles.includes(x.role)).map((x: any) => x.permission as string))]);
    setMyContractorIds((m.data ?? []).map((x: any) => x.contractor_id));
    setEvents((e.data ?? []) as EventRow[]);
    setContractors((c.data ?? []) as Contractor[]);
    setGuards(g);
  }, [session]);

  const loadEvent = useCallback(async () => {
    if (!session || !event) { setLoading(false); return; }
    const [s, a, v, sc, vc] = await Promise.all([
      fetchAll<Slot>((from, to) => supabase.from("roster_slots").select("*").eq("event_id", event.id).order("current_start").order("shift_ref").order("id").range(from, to)),
      fetchAll<Ctx["attendance"][number]>((from, to) => supabase.from("attendance").select("id,guard_id,slot_id,signed_on_at,signed_off_at,sign_off_method,event_id").or(`event_id.eq.${event.id},event_id.is.null`).order("signed_on_at", { ascending: false }).order("id").range(from, to)),
      supabase.from("variations").select("*").eq("event_id", event.id).order("created_at", { ascending: false }),
      canViewCosts ? fetchAll<SlotCost>((from, to) => supabase.from("roster_slot_costs").select("slot_id,hourly_rate,paid_hours").eq("event_id", event.id).order("slot_id").range(from, to)) : Promise.resolve([] as SlotCost[]),
      canViewCosts ? fetchAll<VariationCost>((from, to) => supabase.from("variation_costs").select("variation_id,hourly_rate,original_hours,proposed_hours,original_cost,proposed_cost,cost_delta").eq("event_id", event.id).order("variation_id").range(from, to)) : Promise.resolve([] as VariationCost[]),
    ]);
    setSlots(s);
    setAttendance(a);
    setVariations((v.data ?? []) as unknown as Variation[]);
    setSlotCosts(new Map(sc.map((x) => [x.slot_id, { ...x, hourly_rate: Number(x.hourly_rate), paid_hours: x.paid_hours == null ? null : Number(x.paid_hours) }])));
    setVariationCosts(new Map(vc.map((x) => [x.variation_id, { ...x, hourly_rate: Number(x.hourly_rate), original_hours: Number(x.original_hours), proposed_hours: Number(x.proposed_hours), original_cost: Number(x.original_cost), proposed_cost: Number(x.proposed_cost), cost_delta: Number(x.cost_delta) }])));
    setLoading(false);
  }, [session, event, canViewCosts]);

  const reload = useCallback(async () => { await loadBase(); await loadEvent(); }, [loadBase, loadEvent]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadEvent(); }, [loadEvent]);

  useEffect(() => {
    if (!session) return;
    let timer: number | null = null;
    const bump = () => { if (timer) window.clearTimeout(timer); timer = window.setTimeout(() => loadEvent(), 600); };
    const channel = supabase
      .channel("ops-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_slots" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "variations" }, bump)
      .subscribe();
    return () => { if (timer) window.clearTimeout(timer); supabase.removeChannel(channel); };
  }, [session, loadEvent]);

  const contractorMap = useMemo(() => new Map(contractors.map((c) => [c.id, c.name])), [contractors]);
  const guardMap = useMemo(() => new Map(guards.map((g) => [g.id, g.name])), [guards]);

  const isManager = roles.some((r) => MANAGER_ROLES.includes(r));
  const showCosts = canViewCosts && viewMode === "admin";
  const canApprove = canApproveVariations(roles, permissions) && !(canViewCosts && viewMode === "security");

  const value: Ctx = {
    session, roles, permissions, can: (p) => hasPermission(roles, permissions, p), isManager, canApprove, canViewCosts, showCosts, viewMode, setViewMode, myContractorIds, events, event, setEventId, contractors, guards, slots,
    slotCosts: showCosts ? slotCosts : new Map(), variationCosts: showCosts ? variationCosts : new Map(),
    attendance, variations, loading, reload, now,
    contractorName: (id) => (id ? contractorMap.get(id) ?? "—" : "—"),
    guardName: (id) => (id ? guardMap.get(id) ?? "Unknown guard" : "—"),
  };
  return <OpsCtx.Provider value={value}>{children}</OpsCtx.Provider>;
}

export function useOps() {
  const ctx = useContext(OpsCtx);
  if (!ctx) throw new Error("useOps must be used inside OpsProvider");
  return ctx;
}

/** Security Manager view: real security provider users, or an admin previewing as a Security Manager. */
export function useSecurityView() {
  const { roles, viewMode } = useOps();
  return viewMode === "security" || (!roles.includes("super_admin") && roles.some((r) => SECURITY_USER_TYPES.includes(r)));
}

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as any).message);
  return "Something went wrong";
}

/** Calls a backend function and turns its error reply into a readable message. */
export async function invokeFunction<T = any>(name: string, body: unknown): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const ctx = (error as any).context;
    const reply = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    return { data: reply as T | null, error: reply?.error ?? error.message };
  }
  if (data?.error) return { data, error: data.error };
  return { data, error: null };
}
