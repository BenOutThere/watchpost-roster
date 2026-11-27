// Automation API for the OTG new-event workflow (Control Centre / Claude skills).
// Every call: POST with  Authorization: Bearer <AUTOMATION_API_TOKEN>  and a JSON body { action, ... }.
//
//   { action: "list_events" }
//       events with their sign-off state and position counts, newest first.
//   { action: "get_final_actuals", eventId }
//       one event's final actuals: every active position at its final times (approved variations
//       applied), who signed on, worked hours and hourly rate, with totals.
//   { action: "rollover", fromEventId, name, eventDate?, shiftDays, targetEventId? }
//       builds the next edition's Version 1 roster from a signed-off event's final actuals.
//       Refuses until a Super Admin has signed off the source event's actuals. Running it again
//       for the same new event name returns the event it already made.
//
// Signing off final actuals stays a person's job (Settings → Events), never this API.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list_events") }),
  z.object({ action: z.literal("get_final_actuals"), eventId: z.string().uuid() }),
  z.object({
    action: z.literal("rollover"),
    fromEventId: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    shiftDays: z.number().int().min(-3660).max(3660),
    targetEventId: z.string().uuid().optional().nullable(),
  }),
]);

function sameToken(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const expected = Deno.env.get("AUTOMATION_API_TOKEN") ?? "";
  const given = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (expected.length < 24) return json({ error: "AUTOMATION_API_TOKEN is not set up." }, 503);
  if (!given || !sameToken(given, expected)) return json({ error: "Unauthorised" }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Bad request", details: parsed.error.flatten() }, 400);
  const input = parsed.data;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (input.action === "list_events") {
    const { data: events, error } = await admin
      .from("events")
      .select("id,name,venue,event_date,timezone,actuals_signed_off_at,actuals_signed_off_name,rolled_from_event_id,created_at")
      .order("event_date", { ascending: false, nullsFirst: false });
    if (error) return json({ error: error.message }, 500);
    const out = [];
    for (const e of events ?? []) {
      const { count } = await admin.from("roster_slots").select("id", { count: "exact", head: true }).eq("event_id", e.id).eq("status", "active");
      out.push({ ...e, positions: count ?? 0 });
    }
    return json({ events: out });
  }

  if (input.action === "get_final_actuals") {
    const { data: event } = await admin
      .from("events")
      .select("id,name,venue,event_date,timezone,actuals_signed_off_at,actuals_signed_off_name")
      .eq("id", input.eventId)
      .maybeSingle();
    if (!event) return json({ error: "Event not found" }, 404);
    const { data: rows, error } = await admin.rpc("event_final_actuals_core", { _event_id: input.eventId });
    if (error) return json({ error: error.message }, 500);
    const list = (rows ?? []) as Array<Record<string, any>>;
    const rostered = list.reduce((t, r) => t + Number(r.rostered_hours ?? 0), 0);
    const worked = list.reduce((t, r) => t + Number(r.worked_hours ?? 0), 0);
    const cost = list.reduce((t, r) => t + Number(r.rostered_hours ?? 0) * Number(r.hourly_rate ?? 0), 0);
    return json({
      event,
      signedOff: !!event.actuals_signed_off_at,
      totals: {
        positions: list.length,
        positionsWorked: list.filter((r) => Number(r.guards_signed_on) > 0).length,
        rosteredHours: round2(rostered),
        workedHours: round2(worked),
        rosteredCostExGst: round2(cost),
      },
      positions: list,
    });
  }

  // rollover
  const { data: already } = await admin
    .from("events")
    .select("id,name")
    .eq("rolled_from_event_id", input.fromEventId)
    .eq("name", input.name)
    .maybeSingle();
  if (already && !input.targetEventId) {
    const { count } = await admin.from("roster_slots").select("id", { count: "exact", head: true }).eq("event_id", already.id);
    return json({ eventId: already.id, name: already.name, positions: count ?? 0, alreadyDone: true });
  }
  const { data: newId, error } = await admin.rpc("rollover_event_roster_core", {
    _from_event_id: input.fromEventId,
    _name: input.name,
    _event_date: input.eventDate ?? null,
    _shift_days: input.shiftDays,
    _by: null,
    _target_event_id: input.targetEventId ?? null,
  });
  if (error) return json({ error: error.message }, 409);
  const { count } = await admin.from("roster_slots").select("id", { count: "exact", head: true }).eq("event_id", newId as string);
  return json({ eventId: newId, name: input.name, positions: count ?? 0, alreadyDone: false });
});
