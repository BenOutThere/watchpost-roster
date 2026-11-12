// Receives Tall Bob delivery webhooks. Each Tall Bob account's webhooks carry a secret bearer token
// (set when the connection is tested); requests without the matching token are rejected. Each Tall Bob
// event is stored once, so repeated deliveries of the same webhook change nothing.
import { createClient } from "npm:@supabase/supabase-js@2";
import { mapWebhookStatus, mergeDeliveryStatus, normaliseAuMobile } from "../_shared/sms-core.ts";
import { safeEqual, sha256Hex } from "../_shared/tallbob.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const accountId = new URL(req.url).searchParams.get("a") ?? "";
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!UUID.test(accountId) || !token) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cred } = await admin.from("sms_credentials").select("id,webhook_token_hash").eq("id", accountId).maybeSingle();
  if (!cred?.webhook_token_hash || !safeEqual(await sha256Hex(token), cred.webhook_token_hash)) return json({ error: "Unauthorized" }, 401);

  const raw = await req.text();
  if (raw.length > 100_000) return json({ error: "Payload too large" }, 413);
  let p: Record<string, unknown> = {};
  try { p = JSON.parse(raw); } catch { p = Object.fromEntries(new URLSearchParams(raw)); }
  const eventType = typeof p.eventType === "string" ? p.eventType : typeof p.event_type === "string" ? p.event_type : null;
  const providerEventId = String(p.eventID ?? p.event_id ?? "") || `sha:${await sha256Hex(raw)}`;

  const { error: dupErr } = await admin.from("sms_webhook_events").insert({ provider_event_id: providerEventId, credential_id: accountId, event_type: eventType, payload: p });
  if (dupErr) return dupErr.code === "23505" ? json({ ok: true, duplicate: true }) : json({ error: "Could not record event" }, 500);

  const status = mapWebhookStatus(eventType);
  if (!status) return json({ ok: true, ignored: true });
  const to = normaliseAuMobile(String(p.recipient ?? p.address ?? ""));
  if (!to) return json({ ok: true, matched: false });

  // Match by our reference (+ mobile), only among messages sent with this same Tall Bob account.
  const refs = [p.reference, p.campaign_reference].filter((x) => typeof x === "string" && x) as string[];
  let messageIds: string[] = [];
  if (refs.length) {
    const { data } = await admin.from("sms_messages").select("id").eq("credential_id", accountId).in("provider_reference", refs);
    messageIds = (data ?? []).map((m: { id: string }) => m.id);
  }
  let query = admin.from("sms_recipients").select("id,status,message_id").eq("to_number", to);
  if (messageIds.length) query = query.in("message_id", messageIds);
  else {
    const smsIds = [p.smsID, p.sms_id, p.campaignID].filter((x) => typeof x === "string" && x) as string[];
    if (!smsIds.length) return json({ ok: true, matched: false });
    query = query.in("provider_sms_id", smsIds);
  }
  const { data: rows } = await query;
  let matched = 0;
  for (const r of rows ?? []) {
    if (!messageIds.length) {
      const { data: m } = await admin.from("sms_messages").select("credential_id").eq("id", r.message_id).maybeSingle();
      if (m?.credential_id !== accountId) continue;
    }
    matched++;
    const next = mergeDeliveryStatus(r.status, status);
    if (next !== r.status) {
      await admin.from("sms_recipients").update({
        status: next, updated_at: new Date().toISOString(),
        error: next === "failed" ? `Delivery failed${p.status ? ` (${String(p.status).slice(0, 60)})` : ""}` : null,
      }).eq("id", r.id);
    }
  }
  return json({ ok: true, matched });
});
