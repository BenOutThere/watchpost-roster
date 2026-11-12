// Event SMS settings (Settings → Events → SMS integration). Only users with the manage_sms permission.
// - save: account name, sender ID, environment, on/off, and new API credentials (encrypted here; never
//   returned) or the same Tall Bob account as another event.
// - test: checks the credentials against the event's Tall Bob account, sets up delivery webhooks and can
//   send a test text to a nominated mobile.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { classifyTallBobError, normaliseAuMobile, validateSenderId } from "../_shared/sms-core.ts";
import { decryptCredentials, deliverMessage, displayName, encryptCredentials, registerWebhooks, tbFetch, tbHeaders, tbUrl, userFromRequest } from "../_shared/tallbob.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Save = z.object({
  action: z.literal("save"),
  event_id: z.string().uuid(),
  account_name: z.string().trim().min(1).max(120),
  sender_id: z.string().trim().min(1).max(20),
  environment: z.enum(["production", "sandbox"]),
  enabled: z.boolean(),
  credentials: z.object({ username: z.string().trim().min(1).max(200), api_key: z.string().trim().min(1).max(500) }).optional(),
  link_event_id: z.string().uuid().optional(),
});
const Test = z.object({ action: z.literal("test"), event_id: z.string().uuid(), test_mobile: z.string().trim().max(30).optional() });
const Body = z.discriminatedUnion("action", [Save, Test]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const user = await userFromRequest(req, admin);
  if (!user) return json({ error: "Please sign in again." }, 401);
  const { data: allowed } = await admin.rpc("has_permission", { _user_id: user.id, _permission: "manage_sms" });
  if (!allowed) return json({ error: "Only authorised administrators can change SMS settings." }, 403);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Please check the form.", details: parsed.error.flatten().fieldErrors }, 400);
  const input = parsed.data;

  const { data: event } = await admin.from("events").select("id,name").eq("id", input.event_id).maybeSingle();
  if (!event) return json({ error: "Event not found." }, 404);
  const { data: current } = await admin.from("event_sms_settings").select("*").eq("event_id", event.id).maybeSingle();
  const byName = await displayName(admin, user);
  const now = new Date().toISOString();

  if (input.action === "save") {
    const senderErr = validateSenderId(input.sender_id);
    if (senderErr) return json({ error: senderErr }, 400);
    if (input.credentials && input.link_event_id) return json({ error: "Enter new credentials or choose another event's account, not both." }, 400);

    let credentialId: string | null = current?.credential_id ?? null;
    let credentialsChanged = false;
    if (input.credentials) {
      const enc = await encryptCredentials({ username: input.credentials.username, apiKey: input.credentials.api_key });
      const { data: row, error } = await admin.from("sms_credentials").insert({ ...enc, environment: input.environment, created_by: user.id }).select("id").single();
      if (error) return json({ error: "Could not store the credentials securely." }, 500);
      credentialId = row.id; credentialsChanged = true;
    } else if (input.link_event_id) {
      const { data: other } = await admin.from("event_sms_settings").select("credential_id,environment").eq("event_id", input.link_event_id).maybeSingle();
      if (!other?.credential_id) return json({ error: "That event has no Tall Bob account saved." }, 400);
      if (other.environment !== input.environment) return json({ error: `That account is a ${other.environment === "sandbox" ? "test" : "production"} account. Choose the same environment.` }, 400);
      credentialsChanged = other.credential_id !== credentialId;
      credentialId = other.credential_id;
    } else if (credentialId) {
      const { data: cred } = await admin.from("sms_credentials").select("environment").eq("id", credentialId).maybeSingle();
      if (cred && cred.environment !== input.environment) return json({ error: "Changing between test and production needs that environment's API credentials. Enter them below." }, 400);
    }

    const changed = credentialsChanged || current?.environment !== input.environment || current?.sender_id !== input.sender_id;
    const status = !credentialId ? "not_configured" : changed || !current ? "untested" : current.connection_status;
    const row = {
      event_id: event.id, provider: "tallbob", account_name: input.account_name, sender_id: input.sender_id.trim(),
      environment: input.environment, enabled: input.enabled, credential_id: credentialId, connection_status: status,
      credentials_updated_at: credentialsChanged ? now : current?.credentials_updated_at ?? null,
      updated_at: now, updated_by_name: byName,
    };
    const { error } = await admin.from("event_sms_settings").upsert(row, { onConflict: "event_id" });
    if (error) return json({ error: "Could not save the SMS settings." }, 500);

    // Drop credential records no event uses any more (e.g. after a rotation).
    if (credentialsChanged && current?.credential_id && current.credential_id !== credentialId) {
      const { count } = await admin.from("event_sms_settings").select("event_id", { count: "exact", head: true }).eq("credential_id", current.credential_id);
      if (!count) await admin.from("sms_credentials").delete().eq("id", current.credential_id);
    }
    await admin.from("audit_logs").insert({ actor_user_id: user.id, event_type: "sms_settings_updated", event_details: { event_id: event.id, account_name: input.account_name, sender_id: input.sender_id, environment: input.environment, enabled: input.enabled, credentials_changed: credentialsChanged } });
    return json({ ok: true, connection_status: status });
  }

  // ---- test ----
  const base = { event: event.name, account_name: current?.account_name ?? null, sender_id: current?.sender_id ?? null, environment: current?.environment ?? null, at: now };
  const record = async (result: Record<string, unknown>, ok: boolean) => {
    await admin.from("event_sms_settings").update({
      connection_status: ok ? "connected" : "failed", last_test_at: now, ...(ok ? { last_test_ok_at: now } : {}), last_test: { ...base, ...result, ok },
    }).eq("event_id", event.id);
    return json({ ...base, ...result, ok });
  };
  if (!current?.credential_id) return json({ ...base, ok: false, error: "Save this event's Tall Bob API credentials first." }, 400);
  if (input.test_mobile && !normaliseAuMobile(input.test_mobile)) return json({ ...base, ok: false, error: "Enter a valid Australian mobile number for the test text." }, 400);

  const { data: cred } = await admin.from("sms_credentials").select("id,ciphertext,iv,environment").eq("id", current.credential_id).maybeSingle();
  if (!cred) return record({ error: "The saved credentials couldn't be found. Re-enter them." }, false);
  let creds;
  try { creds = await decryptCredentials(cred); } catch { return record({ error: "The saved credentials couldn't be read. Re-enter them." }, false); }

  const bal = await tbFetch(tbUrl(cred.environment, "/account/balance"), { method: "GET", headers: tbHeaders(creds) });
  if (!bal.ok) return record({ error: classifyTallBobError(bal.status, bal.data, { timeout: bal.timeout }) }, false);
  const balance = (bal.data as { balance?: number; postpay?: boolean }) ?? {};

  const hooks = await registerWebhooks(admin, cred.id, cred.environment, creds);
  const result: Record<string, unknown> = {
    balance: typeof balance.balance === "number" ? balance.balance : null, postpay: !!balance.postpay,
    delivery_tracking: hooks.ok ? "on" : `Not set up: ${hooks.error}`,
  };
  // Mark connected before the optional test text so it can go through the normal sending path.
  await admin.from("event_sms_settings").update({ connection_status: "connected" }).eq("event_id", event.id);

  if (input.test_mobile) {
    if (!current.enabled) { result.test_sms = { ok: false, error: "Switch SMS on for this event to send a test text." }; }
    else {
      const { data: msg } = await admin.from("sms_messages").insert({
        body: `Test message from ${event.name} event security. Your Tall Bob connection for this event is working.`,
        audience_label: "Connection test", recipient_count: 1, status: "sending", event_id: event.id, sent_by_user: user.id, sent_by_name: byName,
      }).select("id").single();
      if (!msg) return record({ ...result, test_sms: { ok: false, error: "Could not record the test text." } }, true);
      await admin.from("sms_recipients").insert({ message_id: msg.id, guard_id: null, phone: input.test_mobile, to_number: normaliseAuMobile(input.test_mobile), status: "pending", submission_status: "pending" });
      const r = await deliverMessage(admin, msg.id);
      result.test_sms = { ok: r.submitted === 1, to: normaliseAuMobile(input.test_mobile), error: r.error ?? null };
    }
  }
  return record(result, true);
});
