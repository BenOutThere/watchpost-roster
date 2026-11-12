// Pure Tall Bob SMS rules shared by the edge functions and the app (tested in src/lib/sms.test.ts).
// No imports and no Deno/browser APIs beyond btoa, so both runtimes can use it.

export type Environment = "production" | "sandbox";
export type DeliveryStatus = "pending" | "submitted" | "queued" | "sent" | "delivered" | "failed" | "skipped" | "not_sent";

export const TALLBOB_BASE: Record<Environment, string> = {
  production: "https://api.tallbob.com/v2",
  sandbox: "https://api-test.tallbob.com/v2",
};

/** Largest batch per list_send request (Tall Bob allows 1000 recipients and 1 MB per request). */
export const LIST_SEND_CHUNK = 500;
export const MAX_SMS_LENGTH = 1530;

export type EventSmsSettings = {
  event_id: string;
  account_name: string | null;
  credential_id: string | null;
  sender_id: string | null;
  environment: string;
  enabled: boolean;
  connection_status: string;
};

/**
 * Australian mobile → Tall Bob's E.164 digits without "+" (e.g. "61412345678"), or null if it isn't one.
 * Accepts 0412 345 678, +61 412 345 678, 61412345678, 412345678, 0061…, and the common "+61 0412…" slip.
 */
export function normaliseAuMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).trim().replace(/[\s\-().]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (!/^\d+$/.test(d)) return null;
  if (d.startsWith("0061")) d = d.slice(2);
  if (/^6104\d{8}$/.test(d)) d = "61" + d.slice(3);
  else if (/^04\d{8}$/.test(d)) d = "61" + d.slice(1);
  else if (/^4\d{8}$/.test(d)) d = "61" + d;
  return /^614\d{8}$/.test(d) ? d : null;
}

export const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "there";

/** Replaces {name} with the recipient's first name. */
export const renderBody = (body: string, name: string | null | undefined) => body.replace(/\{name\}/gi, firstName(name));

/**
 * Splits recipients into those to text (one per mobile number), those without a valid mobile,
 * and repeats of a number already in this send.
 */
export function planRecipients<T extends { id: string; phone: string | null | undefined }>(rows: T[]) {
  const seen = new Set<string>();
  const send: (T & { to: string })[] = [];
  const invalid: T[] = [];
  const duplicate: T[] = [];
  for (const r of rows) {
    const to = normaliseAuMobile(r.phone);
    if (!to) invalid.push(r);
    else if (seen.has(to)) duplicate.push(r);
    else { seen.add(to); send.push({ ...r, to }); }
  }
  return { send, invalid, duplicate };
}

export type AccountCheck = { ok: true; code?: undefined; error?: undefined } | { ok: false; code: string; error: string };

/**
 * Is this event's own Tall Bob connection ready to send? Only the settings row for this exact event counts —
 * there is never a fallback to another event's account.
 */
export function checkEventAccount(eventId: string | null | undefined, settings: EventSmsSettings | null | undefined): AccountCheck {
  const where = "A Super Admin can set it up in Settings → Events → SMS integration.";
  if (!eventId) return { ok: false, code: "no_event", error: "This message isn't linked to an event, so no SMS account can be chosen." };
  if (!settings || settings.event_id !== eventId) return { ok: false, code: "not_configured", error: `SMS isn't set up for this event yet. ${where}` };
  if (!settings.credential_id) return { ok: false, code: "missing_credentials", error: `This event has no Tall Bob API credentials saved. ${where}` };
  if (!settings.sender_id) return { ok: false, code: "missing_sender", error: `This event has no sender ID. ${where}` };
  if (!settings.enabled) return { ok: false, code: "disabled", error: `SMS is switched off for this event. ${where}` };
  if (settings.connection_status !== "connected") return { ok: false, code: "not_tested", error: `This event's Tall Bob connection hasn't passed a test yet. ${where}` };
  return { ok: true };
}

/** Picks the settings row and credentials for an event from all configured events. Never borrows another event's. */
export function resolveEventAccount<C extends { id: string }>(eventId: string | null | undefined, allSettings: EventSmsSettings[], credentials: C[]):
  { ok: true; settings: EventSmsSettings; credential: C } | { ok: false; code: string; error: string } {
  const settings = allSettings.find((s) => s.event_id === eventId) ?? null;
  const check = checkEventAccount(eventId, settings);
  if (!check.ok) return check as { ok: false; code: string; error: string };
  const credential = credentials.find((c) => c.id === settings!.credential_id);
  if (!credential) return { ok: false, code: "missing_credentials", error: "This event's saved Tall Bob credentials couldn't be found. Re-enter them in Settings → Events → SMS integration." };
  return { ok: true, settings: settings!, credential };
}

/** Alphanumeric sender (1–11 letters/numbers, at least one letter) or a phone number. Returns an error or null. */
export function validateSenderId(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return "Enter a sender ID.";
  if (/^\+?\d{8,15}$/.test(s.replace(/\s/g, ""))) return null;
  if (s.length > 11) return "An alphanumeric sender ID can be at most 11 characters.";
  if (!/^[A-Za-z0-9 ]+$/.test(s) || !/[A-Za-z]/.test(s)) return "Use letters and numbers only (at least one letter), or a phone number.";
  return null;
}

export const basicAuth = (username: string, apiKey: string) => "Basic " + btoa(`${username}:${apiKey}`);

/** Our reference for one send; Tall Bob echoes it in delivery webhooks (matched together with the mobile number). */
export const makeReference = (messageId: string) => "OT" + messageId.replace(/-/g, "").slice(0, 18).toUpperCase();

export type SendRequest = { url: string; init: { method: "POST"; headers: Record<string, string>; body: string }; ids: string[] };

/**
 * Builds the Tall Bob API calls for one message using the event's own account: Send Single SMS for one
 * recipient, Send SMS To List of Mobiles (each with its own personalised text) for more.
 */
export function buildSendRequests(opts: {
  environment: string; username: string; apiKey: string; sender: string; reference: string;
  recipients: { id: string; to: string; message: string }[];
}): SendRequest[] {
  const base = TALLBOB_BASE[(opts.environment === "sandbox" ? "sandbox" : "production") as Environment];
  const headers = { "Content-Type": "application/json", Accept: "application/json", Authorization: basicAuth(opts.username, opts.apiKey) };
  if (opts.recipients.length === 0) return [];
  if (opts.recipients.length === 1) {
    const r = opts.recipients[0];
    return [{ url: `${base}/sms/send`, ids: [r.id], init: { method: "POST", headers, body: JSON.stringify({ to: r.to, from: opts.sender, message: r.message, reference: opts.reference }) } }];
  }
  const out: SendRequest[] = [];
  for (let i = 0; i < opts.recipients.length; i += LIST_SEND_CHUNK) {
    const chunk = opts.recipients.slice(i, i + LIST_SEND_CHUNK);
    const to: Record<string, { message: string }> = {};
    chunk.forEach((r) => { to[r.to] = { message: r.message }; });
    out.push({ url: `${base}/sms/list_send`, ids: chunk.map((r) => r.id), init: { method: "POST", headers, body: JSON.stringify({ to, from: opts.sender, message: "{{ message }}", reference: opts.reference }) } });
  }
  return out;
}

/** Tall Bob webhook event type → status shown in history. A queued message is never treated as delivered. */
export function mapWebhookStatus(eventType: string | null | undefined): DeliveryStatus | null {
  switch (eventType) {
    case "message_polling": return "queued";
    case "message_pushed": return "sent";
    case "message_delivered": return "delivered";
    case "message_delivery_error": return "failed";
    default: return null;
  }
}

const rank: Record<string, number> = { not_sent: 0, pending: 0, submitted: 1, queued: 2, sent: 3, delivered: 5 };

/** Statuses only move forward (webhooks can arrive out of order); a delivery receipt beats an earlier failure. */
export function mergeDeliveryStatus(current: string, incoming: DeliveryStatus): string {
  if (current === "skipped") return current;
  if (incoming === "delivered") return "delivered";
  if (current === "delivered") return current;
  if (incoming === "failed") return "failed";
  if (current === "failed") return current;
  return (rank[incoming] ?? 0) > (rank[current] ?? 0) ? incoming : current;
}

/** Plain-language error for a failed Tall Bob call. Never includes credentials. */
export function classifyTallBobError(status: number | null, body: unknown, opts: { timeout?: boolean } = {}): string {
  if (opts.timeout) return "Tall Bob didn't respond in time. The text may still have gone out — check the history before resending.";
  if (status === null) return "Couldn't reach Tall Bob. Try again shortly.";
  const b = (body && typeof body === "object" ? body : {}) as { message?: unknown; errors?: Record<string, unknown> };
  const message = typeof b.message === "string" ? b.message : typeof body === "string" ? body : "";
  const errors = b.errors && typeof b.errors === "object" ? b.errors : {};
  const detail = [message, ...Object.values(errors).flat().map(String)].filter(Boolean).join(" ").slice(0, 300);
  const text = detail.toLowerCase();
  if (status === 401) return "Tall Bob rejected the API username or key for this event's account.";
  if (status === 429) return "Tall Bob is limiting how fast texts can be sent. Try again in a minute.";
  if (status === 402 || /balance|credit|insufficient|funds/.test(text)) return "Not enough credit on this event's Tall Bob account.";
  if (/opted out|opt-out|opt out/.test(text)) return "This number has opted out of texts from this account.";
  if ("from" in errors || /sender|\bfrom\b/.test(text)) return `Tall Bob didn't accept the sender ID${detail ? ` (${detail})` : ""}.`;
  if ("to" in errors || /recipient|mobile|number/.test(text)) return `Tall Bob rejected the mobile number${detail ? ` (${detail})` : ""}.`;
  if (status === 403) return "This Tall Bob account isn't allowed to do that. Check the account's permissions with Tall Bob.";
  if (status >= 500) return `Tall Bob had a service problem (error ${status}). Try again shortly.`;
  return `Tall Bob error ${status}${detail ? `: ${detail}` : ""}.`;
}
