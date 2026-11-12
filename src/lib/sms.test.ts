import { describe, expect, it } from "vitest";
import {
  buildSendRequests, checkEventAccount, classifyTallBobError, mapWebhookStatus, mergeDeliveryStatus, normaliseAuMobile,
  planRecipients, renderBody, resolveEventAccount, validateSenderId, type EventSmsSettings,
} from "./sms";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
const C = "cccccccc-0000-0000-0000-000000000003";
const D = "dddddddd-0000-0000-0000-000000000004"; // no SMS set up

const settings: EventSmsSettings[] = [
  { event_id: A, account_name: "Summernats", credential_id: "cred-a", sender_id: "Summernats", environment: "production", enabled: true, connection_status: "connected" },
  { event_id: B, account_name: "Stadium Fest", credential_id: "cred-b", sender_id: "StadiumFest", environment: "production", enabled: true, connection_status: "connected" },
  { event_id: C, account_name: "Test event", credential_id: "cred-c", sender_id: "TestSec", environment: "sandbox", enabled: true, connection_status: "connected" },
];
const creds = [
  { id: "cred-a", username: "user-a", apiKey: "key-a" },
  { id: "cred-b", username: "user-b", apiKey: "key-b" },
  { id: "cred-c", username: "user-c", apiKey: "key-c" },
];
const auth = (u: string, k: string) => "Basic " + btoa(`${u}:${k}`);

function requestsFor(eventId: string) {
  const r = resolveEventAccount(eventId, settings, creds);
  if (!r.ok) throw new Error((r as { error: string }).error);
  return buildSendRequests({
    environment: r.settings.environment, username: r.credential.username, apiKey: r.credential.apiKey,
    sender: r.settings.sender_id!, reference: "OTREF", recipients: [{ id: "r1", to: "61412345678", message: "Hi" }],
  });
}

describe("each event sends with its own Tall Bob account", () => {
  it("Event A uses account A and its sender", () => {
    const [req] = requestsFor(A);
    expect(req.init.headers.Authorization).toBe(auth("user-a", "key-a"));
    expect(JSON.parse(req.init.body).from).toBe("Summernats");
    expect(req.url).toBe("https://api.tallbob.com/v2/sms/send");
  });
  it("Event B uses account B", () => {
    const [req] = requestsFor(B);
    expect(req.init.headers.Authorization).toBe(auth("user-b", "key-b"));
    expect(JSON.parse(req.init.body).from).toBe("StadiumFest");
  });
  it("Event C uses account C on Tall Bob's test environment", () => {
    const [req] = requestsFor(C);
    expect(req.init.headers.Authorization).toBe(auth("user-c", "key-c"));
    expect(req.url).toBe("https://api-test.tallbob.com/v2/sms/send");
  });
  it("never uses another event's credentials", () => {
    for (const [ev, own] of [[A, "user-a"], [B, "user-b"], [C, "user-c"]]) {
      const header = requestsFor(ev)[0].init.headers.Authorization;
      for (const other of creds.filter((c) => c.username !== own)) expect(header).not.toBe(auth(other.username, other.apiKey));
    }
  });
  it("an event without SMS set up is refused, with no fallback to another account", () => {
    const r = resolveEventAccount(D, settings, creds);
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe("not_configured");
  });
});

describe("missing or inactive configuration prevents sending", () => {
  const base = settings[0];
  it("no credentials", () => expect(checkEventAccount(A, { ...base, credential_id: null })).toMatchObject({ ok: false, code: "missing_credentials" }));
  it("no sender ID", () => expect(checkEventAccount(A, { ...base, sender_id: null })).toMatchObject({ ok: false, code: "missing_sender" }));
  it("switched off", () => expect(checkEventAccount(A, { ...base, enabled: false })).toMatchObject({ ok: false, code: "disabled" }));
  it("not yet tested", () => expect(checkEventAccount(A, { ...base, connection_status: "untested" })).toMatchObject({ ok: false, code: "not_tested" }));
  it("settings for a different event don't count", () => expect(checkEventAccount(B, base)).toMatchObject({ ok: false, code: "not_configured" }));
  it("message without an event", () => expect(checkEventAccount(null, base)).toMatchObject({ ok: false, code: "no_event" }));
  it("credentials saved for the event but missing from storage", () => expect(resolveEventAccount(A, settings, [])).toMatchObject({ ok: false, code: "missing_credentials" }));
});

describe("Australian mobile numbers", () => {
  it.each([
    ["0412 345 678", "61412345678"], ["+61 412 345 678", "61412345678"], ["61412345678", "61412345678"],
    ["412345678", "61412345678"], ["0061412345678", "61412345678"], ["+61 0412 345 678", "61412345678"], ["(04) 1234-5678", "61412345678"],
  ])("%s → %s", (raw, out) => expect(normaliseAuMobile(raw)).toBe(out));
  it.each(["02 9876 5432", "0412 345 67", "+64 21 123 4567", "", null, "abc"])("rejects %s", (raw) => expect(normaliseAuMobile(raw as string)).toBeNull());
});

describe("recipients in one send", () => {
  it("removes duplicate mobile numbers and flags invalid ones", () => {
    const p = planRecipients([
      { id: "1", phone: "0412 345 678" }, { id: "2", phone: "+61412345678" }, { id: "3", phone: "0400 000 001" }, { id: "4", phone: "02 1234 5678" }, { id: "5", phone: null },
    ]);
    expect(p.send.map((r) => r.id)).toEqual(["1", "3"]);
    expect(p.duplicate.map((r) => r.id)).toEqual(["2"]);
    expect(p.invalid.map((r) => r.id)).toEqual(["4", "5"]);
  });
  it("uses list send for several recipients, each with their own text", () => {
    const reqs = buildSendRequests({ environment: "production", username: "u", apiKey: "k", sender: "S", reference: "R", recipients: [{ id: "1", to: "61400000001", message: "Hi Sam" }, { id: "2", to: "61400000002", message: "Hi Jo" }] });
    expect(reqs).toHaveLength(1);
    expect(reqs[0].url).toBe("https://api.tallbob.com/v2/sms/list_send");
    expect(JSON.parse(reqs[0].init.body).to).toEqual({ "61400000001": { message: "Hi Sam" }, "61400000002": { message: "Hi Jo" } });
  });
  it("splits big sends into batches of 500", () => {
    const recipients = Array.from({ length: 1201 }, (_, i) => ({ id: String(i), to: `614${String(i).padStart(8, "0")}`, message: "x" }));
    expect(buildSendRequests({ environment: "production", username: "u", apiKey: "k", sender: "S", reference: "R", recipients }).map((r) => r.ids.length)).toEqual([500, 500, 201]);
  });
  it("puts the guard's first name into {name}", () => expect(renderBody("Hi {name}, go", "Sam Lee")).toBe("Hi Sam, go"));
});

describe("delivery statuses", () => {
  it("maps Tall Bob webhook events", () => {
    expect(mapWebhookStatus("message_polling")).toBe("queued");
    expect(mapWebhookStatus("message_pushed")).toBe("sent");
    expect(mapWebhookStatus("message_delivered")).toBe("delivered");
    expect(mapWebhookStatus("message_delivery_error")).toBe("failed");
    expect(mapWebhookStatus("clicktrack")).toBeNull();
  });
  it("a queued message is not delivered", () => expect(mergeDeliveryStatus("submitted", "queued")).toBe("queued"));
  it("never moves backwards when webhooks arrive out of order", () => expect(mergeDeliveryStatus("delivered", "sent")).toBe("delivered"));
  it("failure after sent is failed", () => expect(mergeDeliveryStatus("sent", "failed")).toBe("failed"));
  it("a later delivery receipt beats a failure", () => expect(mergeDeliveryStatus("failed", "delivered")).toBe("delivered"));
});

describe("sender IDs and errors", () => {
  it("accepts an 11-character alphanumeric sender", () => expect(validateSenderId("Summernats1")).toBeNull());
  it("rejects senders over 11 characters", () => expect(validateSenderId("SummernatsSec")).not.toBeNull());
  it("accepts a virtual number", () => expect(validateSenderId("+61400000000")).toBeNull());
  it("bad credentials", () => expect(classifyTallBobError(401, {})).toMatch(/username or key/));
  it("rate limited", () => expect(classifyTallBobError(429, {})).toMatch(/limiting/));
  it("low balance", () => expect(classifyTallBobError(400, { message: "Insufficient balance" })).toMatch(/credit/));
  it("timeout warns it may have been sent", () => expect(classifyTallBobError(null, null, { timeout: true })).toMatch(/may still have gone out/));
  it("never echoes credentials", () => expect(classifyTallBobError(401, { message: "bad" })).not.toMatch(/key-a|user-a/));
});
