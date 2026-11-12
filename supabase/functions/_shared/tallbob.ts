// Server-side Tall Bob integration: credential encryption, API calls and sending one stored message
// through the Tall Bob account of the message's own event.
import {
  basicAuth, buildSendRequests, checkEventAccount, classifyTallBobError, makeReference, planRecipients, renderBody,
  TALLBOB_BASE, type EventSmsSettings, type SendRequest,
} from "./sms-core.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;
export type Credentials = { username: string; apiKey: string };

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key() {
  const secret = Deno.env.get("SMS_CREDENTIALS_KEY");
  if (!secret) throw new Error("SMS_CREDENTIALS_KEY is not configured");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptCredentials(c: Credentials) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify({ u: c.username, k: c.apiKey }));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), data));
  return { ciphertext: b64(ct), iv: b64(iv) };
}

export async function decryptCredentials(row: { ciphertext: string; iv: string }): Promise<Credentials> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(row.iv) }, await key(), unb64(row.ciphertext));
  const o = JSON.parse(new TextDecoder().decode(pt));
  return { username: o.u, apiKey: o.k };
}

export async function sha256Hex(s: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...d].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export type TbResult = { ok: boolean; status: number | null; data: unknown; timeout?: boolean };

/** One Tall Bob call with a timeout; rate-limited calls are retried a couple of times with a short wait. */
export async function tbFetch(url: string, init: RequestInit, timeoutMs = 15000): Promise<TbResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      const text = await res.text();
      let data: unknown = text;
      try { data = text ? JSON.parse(text) : null; } catch { /* plain text */ }
      if (res.status === 429 && attempt < 2) { await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt)); continue; }
      // Tall Bob sometimes answers 200 with {"message":"invalid request","code":9998}.
      const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
      const softError = res.ok && ("errors" in o || (typeof o.code === "number" && "message" in o && !("sms_id" in o)));
      return { ok: res.ok && !softError, status: softError ? 400 : res.status, data };
    } catch (e) {
      const timeout = e instanceof DOMException && e.name === "AbortError";
      return { ok: false, status: null, data: null, timeout };
    } finally { clearTimeout(t); }
  }
  return { ok: false, status: 429, data: null };
}

export const tbUrl = (environment: string, path: string) => `${TALLBOB_BASE[environment === "sandbox" ? "sandbox" : "production"]}${path}`;
export const tbHeaders = (c: Credentials) => ({ "Content-Type": "application/json", Accept: "application/json", Authorization: basicAuth(c.username, c.apiKey) });

const WEBHOOK_EVENTS = ["message_polling", "message_pushed", "message_delivered", "message_delivery_error"];
export const webhookUrl = (credentialId: string) => `${Deno.env.get("SUPABASE_URL")}/functions/v1/tallbob-webhook?a=${credentialId}`;

/** (Re)registers this account's delivery webhooks, authenticated with a fresh secret token only we and Tall Bob hold. */
export async function registerWebhooks(admin: Admin, credentialId: string, environment: string, creds: Credentials): Promise<{ ok: boolean; error?: string }> {
  const url = webhookUrl(credentialId);
  const headers = tbHeaders(creds);
  const list = await tbFetch(tbUrl(environment, `/webhooks?per_page=100&url=${encodeURIComponent(url)}`), { method: "GET", headers });
  if (!list.ok) return { ok: false, error: classifyTallBobError(list.status, list.data, { timeout: list.timeout }) };
  const existing = ((list.data as { data?: { id: string; url: string }[] })?.data ?? []).filter((w) => w.url === url);
  for (const w of existing) await tbFetch(tbUrl(environment, `/webhooks/${w.id}`), { method: "DELETE", headers });
  const token = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[^A-Za-z0-9]/g, "");
  for (const event_type of WEBHOOK_EVENTS) {
    const r = await tbFetch(tbUrl(environment, "/webhooks"), {
      method: "POST", headers,
      body: JSON.stringify({ name: `Event security delivery (${event_type})`, url, event_type, enabled: true, authorization: `Bearer ${token}` }),
    });
    if (!r.ok) return { ok: false, error: classifyTallBobError(r.status, r.data, { timeout: r.timeout }) };
  }
  await admin.from("sms_credentials").update({ webhook_token_hash: await sha256Hex(token), webhooks_registered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", credentialId);
  return { ok: true };
}

async function allRecipients(admin: Admin, messageId: string) {
  const out: { id: string; guard_id: string | null; phone: string | null; to_number: string | null; submission_status: string }[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await admin.from("sms_recipients").select("id,guard_id,phone,to_number,submission_status").eq("message_id", messageId).order("id").range(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function updateIds(admin: Admin, ids: string[], patch: Record<string, unknown>) {
  for (let i = 0; i < ids.length; i += 200) await admin.from("sms_recipients").update({ ...patch, updated_at: new Date().toISOString() }).in("id", ids.slice(i, i + 200));
}

export type DeliverResult = { submitted: number; failed: number; skipped: number; status: string; error?: string };

/**
 * Sends one stored message through the Tall Bob account of the message's event and records the result per
 * recipient. If the event has no active connection nothing is sent and the message is marked failed.
 */
export async function deliverMessage(admin: Admin, messageId: string, sendRequest: (r: SendRequest) => Promise<TbResult> = (r) => tbFetch(r.url, r.init)): Promise<DeliverResult> {
  const { data: msg } = await admin.from("sms_messages").select("id,body,event_id,provider_reference").eq("id", messageId).single();
  const rows = (await allRecipients(admin, messageId)).filter((r) => r.submission_status === "pending");
  const now = () => new Date().toISOString();
  const failAll = async (error: string): Promise<DeliverResult> => {
    await updateIds(admin, rows.map((r) => r.id), { status: "failed", submission_status: "failed", error });
    await admin.from("sms_messages").update({ status: "failed", error, sent_at: now() }).eq("id", messageId);
    return { submitted: 0, failed: rows.length, skipped: 0, status: "failed", error };
  };
  if (!msg) return { submitted: 0, failed: 0, skipped: 0, status: "failed", error: "Message not found" };

  const { data: settings } = msg.event_id
    ? await admin.from("event_sms_settings").select("*").eq("event_id", msg.event_id).maybeSingle()
    : { data: null };
  const check = checkEventAccount(msg.event_id, settings as EventSmsSettings | null);
  if (!check.ok) return failAll(check.error);
  const { data: cred } = await admin.from("sms_credentials").select("id,ciphertext,iv,environment").eq("id", settings.credential_id).maybeSingle();
  if (!cred) return failAll("This event's saved Tall Bob credentials couldn't be found. Re-enter them in Settings → Events → SMS integration.");
  let creds: Credentials;
  try { creds = await decryptCredentials(cred); } catch { return failAll("This event's saved Tall Bob credentials couldn't be read. Re-enter them in Settings → Events → SMS integration."); }

  const reference = msg.provider_reference ?? makeReference(msg.id);
  await admin.from("sms_messages").update({ credential_id: cred.id, provider_account: settings.account_name, sender_id: settings.sender_id, provider_reference: reference }).eq("id", msg.id);

  const guardIds = [...new Set(rows.map((r) => r.guard_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  for (let i = 0; i < guardIds.length; i += 200) {
    const { data } = await admin.from("guards").select("id,name").in("id", guardIds.slice(i, i + 200));
    (data ?? []).forEach((g: { id: string; name: string }) => names.set(g.id, g.name));
  }
  const plan = planRecipients(rows.map((r) => ({ ...r, phone: r.to_number ?? r.phone })));
  await updateIds(admin, plan.invalid.map((r) => r.id), { status: "failed", submission_status: "failed", error: "No valid Australian mobile number" });
  await updateIds(admin, plan.duplicate.map((r) => r.id), { status: "skipped", submission_status: "skipped", error: "Same mobile number is already in this send" });
  const fix = plan.send.filter((r) => r.to_number !== r.to);
  for (let i = 0; i < fix.length; i += 25) await Promise.all(fix.slice(i, i + 25).map((r) => admin.from("sms_recipients").update({ to_number: r.to }).eq("id", r.id)));

  const requests = buildSendRequests({
    environment: cred.environment, username: creds.username, apiKey: creds.apiKey, sender: settings.sender_id, reference,
    recipients: plan.send.map((r) => ({ id: r.id, to: r.to, message: renderBody(msg.body, r.guard_id ? names.get(r.guard_id) : null) })),
  });
  let submitted = 0, failed = plan.invalid.length;
  const errors = new Set<string>();
  for (const req of requests) {
    const res = await sendRequest(req);
    if (res.ok) {
      submitted += req.ids.length;
      const smsId = (res.data as { sms_id?: string })?.sms_id ?? null;
      await updateIds(admin, req.ids, { status: "submitted", submission_status: "submitted", provider_sms_id: smsId, error: null });
    } else {
      failed += req.ids.length;
      const error = classifyTallBobError(res.status, res.data, { timeout: res.timeout });
      errors.add(error);
      await updateIds(admin, req.ids, { status: "failed", submission_status: "failed", error });
    }
  }
  if (plan.invalid.length) errors.add(`${plan.invalid.length} without a valid mobile number`);
  const status = submitted === 0 ? "failed" : failed > 0 ? "partly_failed" : "submitted";
  const error = errors.size ? [...errors].join(" · ").slice(0, 500) : null;
  await admin.from("sms_messages").update({ status, error, sent_at: now() }).eq("id", messageId);
  return { submitted, failed, skipped: plan.duplicate.length, status, error: error ?? undefined };
}

export async function userFromRequest(req: Request, admin: Admin) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user as { id: string; email?: string };
}

export async function displayName(admin: Admin, user: { id: string; email?: string }) {
  const { data } = await admin.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
  return (data?.full_name as string) || user.email || "Unknown user";
}
