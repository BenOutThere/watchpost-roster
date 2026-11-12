// Sends a text from Communications. The event decides the Tall Bob account; the sender never picks one.
// Checks the sender may message every chosen guard (security providers: only their own guards), refuses
// to send if the event has no active Tall Bob connection, and ignores repeats of the same send (client_key).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { checkEventAccount, MAX_SMS_LENGTH, normaliseAuMobile, type EventSmsSettings } from "../_shared/sms-core.ts";
import { deliverMessage, displayName, userFromRequest } from "../_shared/tallbob.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({
  event_id: z.string().uuid(),
  body: z.string().trim().min(1).max(MAX_SMS_LENGTH),
  audience_label: z.string().trim().min(1).max(200),
  guard_ids: z.array(z.string().uuid()).min(1).max(5000),
  variation_id: z.string().uuid().nullable().optional(),
  client_key: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const user = await userFromRequest(req, admin);
  if (!user) return json({ error: "Please sign in again." }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, 400);
  const input = parsed.data;

  const [{ data: canComms }, { data: staff }, { data: members }] = await Promise.all([
    admin.rpc("has_permission", { _user_id: user.id, _permission: "view_communications" }),
    admin.rpc("is_event_staff", { _user_id: user.id }),
    admin.from("contractor_members").select("contractor_id").eq("user_id", user.id),
  ]);
  const myContractors = (members ?? []).map((m: { contractor_id: string }) => m.contractor_id);
  if (!canComms || (!staff && myContractors.length === 0)) return json({ error: "You don't have access to send messages." }, 403);

  // Repeat of a send that already happened (double click, retry after a slow network): don't send again.
  const { data: existing } = await admin.from("sms_messages").select("id,status,error").eq("client_key", input.client_key).maybeSingle();
  if (existing) return json({ duplicate: true, message_id: existing.id, status: existing.status, error: existing.error });

  const { data: event } = await admin.from("events").select("id,name").eq("id", input.event_id).maybeSingle();
  if (!event) return json({ error: "Event not found." }, 404);
  if (input.variation_id) {
    const { data: v } = await admin.from("variations").select("event_id").eq("id", input.variation_id).maybeSingle();
    if (!v || v.event_id !== event.id) return json({ error: "That variation belongs to a different event." }, 400);
  }

  const { data: settings } = await admin.from("event_sms_settings").select("*").eq("event_id", event.id).maybeSingle();
  const check = checkEventAccount(event.id, settings as EventSmsSettings | null);
  if (!check.ok) return json({ error: check.error, code: check.code }, 409);

  const ids = [...new Set(input.guard_ids)];
  const guards: { id: string; phone: string | null; contractor_id: string | null }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("guards").select("id,phone,contractor_id").in("id", ids.slice(i, i + 200));
    guards.push(...(data ?? []));
  }
  if (guards.length !== ids.length) return json({ error: "Some selected guards no longer exist. Refresh and try again." }, 400);
  if (!staff && guards.some((g) => !g.contractor_id || !myContractors.includes(g.contractor_id))) {
    return json({ error: "You can only message guards from your own security provider." }, 403);
  }

  const contractorId = staff ? null : (guards.find((g) => g.contractor_id && myContractors.includes(g.contractor_id))?.contractor_id ?? myContractors[0]);
  const { data: msg, error: insErr } = await admin.from("sms_messages").insert({
    body: input.body, audience_label: input.audience_label, recipient_count: guards.length, status: "sending",
    contractor_id: contractorId, variation_id: input.variation_id ?? null, event_id: event.id,
    sent_by_user: user.id, sent_by_name: await displayName(admin, user), client_key: input.client_key,
  }).select("id").single();
  if (insErr) {
    if (insErr.code === "23505") return json({ duplicate: true });
    return json({ error: "Could not save the message." }, 500);
  }
  for (let i = 0; i < guards.length; i += 500) {
    const { error } = await admin.from("sms_recipients").insert(guards.slice(i, i + 500).map((g) => ({
      message_id: msg.id, guard_id: g.id, phone: g.phone, to_number: normaliseAuMobile(g.phone), status: "pending", submission_status: "pending",
    })));
    if (error) {
      await admin.from("sms_messages").update({ status: "failed", error: "Could not save the recipient list" }).eq("id", msg.id);
      return json({ error: "Could not save the recipient list." }, 500);
    }
  }

  try {
    const result = await deliverMessage(admin, msg.id);
    return json({ message_id: msg.id, ...result });
  } catch (e) {
    const error = `Sending stopped unexpectedly: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500);
    await admin.from("sms_messages").update({ status: "failed", error }).eq("id", msg.id);
    return json({ error }, 500);
  }
});
