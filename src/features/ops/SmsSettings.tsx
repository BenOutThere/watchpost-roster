import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime, } from "@/lib/roster";
import { validateSenderId } from "@/lib/sms";
import { invokeFunction, useOps } from "./OpsContext";
import { Field, Panel, Pill, Row, useFlash } from "./ui";

type SmsSettingsRow = {
  event_id: string; account_name: string | null; credential_id: string | null; sender_id: string | null; environment: string;
  enabled: boolean; connection_status: string; last_test_at: string | null; last_test_ok_at: string | null; last_test: any;
  credentials_updated_at: string | null; updated_at: string; updated_by_name: string | null;
};

/** Settings → Events → SMS integration: this event's own Tall Bob account. Secrets are entered here but never shown again. */
export function SmsIntegration({ eventId, eventName }: { eventId: string; eventName: string }) {
  const { events, event } = useOps();
  const tz = event?.timezone ?? "Australia/Sydney";
  const [all, setAll] = useState<SmsSettingsRow[]>([]);
  const [f, setF] = useState({ account_name: "", sender_id: "", environment: "production", enabled: false });
  const [credMode, setCredMode] = useState<"keep" | "new" | "link">("keep");
  const [username, setUsername] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [linkEvent, setLinkEvent] = useState("");
  const [testMobile, setTestMobile] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "test" | "sms">("");
  const flash = useFlash();

  const current = all.find((s) => s.event_id === eventId) ?? null;
  const load = async () => {
    const { data } = await supabase.from("event_sms_settings").select("*");
    setAll((data ?? []) as SmsSettingsRow[]);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    setF({ account_name: current?.account_name ?? "", sender_id: current?.sender_id ?? "", environment: current?.environment ?? "production", enabled: current?.enabled ?? false });
    setCredMode(current?.credential_id ? "keep" : "new");
    setUsername(""); setApiKey(""); setLinkEvent(""); flash.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, current?.updated_at]);

  const eventName_ = (id: string) => events.find((e) => e.id === id)?.name ?? "Another event";
  const sharedWith = current?.credential_id ? all.filter((s) => s.credential_id === current.credential_id && s.event_id !== eventId) : [];
  const linkable = all.filter((s) => s.event_id !== eventId && s.credential_id && s.credential_id !== current?.credential_id);

  const save = async () => {
    const senderErr = validateSenderId(f.sender_id);
    if (!f.account_name.trim()) return flash.show("Enter the Tall Bob sub-account name.", true);
    if (senderErr) return flash.show(senderErr, true);
    if (credMode === "new" && (!username.trim() || !apiKey.trim())) return flash.show("Enter the API username and API key.", true);
    if (credMode === "link" && !linkEvent) return flash.show("Choose the event whose Tall Bob account to share.", true);
    setBusy("save");
    const { data, error } = await invokeFunction("sms-settings", {
      action: "save", event_id: eventId, account_name: f.account_name.trim(), sender_id: f.sender_id.trim(), environment: f.environment, enabled: f.enabled,
      ...(credMode === "new" ? { credentials: { username: username.trim(), api_key: apiKey.trim() } } : {}),
      ...(credMode === "link" ? { link_event_id: linkEvent } : {}),
    });
    setBusy("");
    setApiKey(""); setUsername("");
    if (error) return flash.show(error, true);
    await load();
    flash.show(data?.connection_status === "connected" ? "Saved." : "Saved. Now test the connection — texts can't be sent until the test passes.");
  };

  const test = async (withSms: boolean) => {
    if (withSms && !testMobile.trim()) return flash.show("Enter a mobile number for the test text.", true);
    setBusy(withSms ? "sms" : "test");
    const { error } = await invokeFunction("sms-settings", { action: "test", event_id: eventId, ...(withSms ? { test_mobile: testMobile.trim() } : {}) });
    setBusy("");
    await load();
    if (error) flash.show(error, true); else flash.clear();
  };

  const t = current?.last_test;
  return (
    <Panel title="SMS integration" description={`Texts for ${eventName} are sent from this event's own Tall Bob account. Nobody chooses an account when sending.`}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">Tall Bob</span>
        <Pill status={current ? current.connection_status : "not_configured"} />
        {current && !current.enabled && <Pill status="not_sent" label="Switched off" />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tall Bob sub-account name"><input className="control-input h-11" value={f.account_name} onChange={(e) => setF({ ...f, account_name: e.target.value })} placeholder="e.g. Summernats 39" /></Field>
        <Field label="Sender ID" hint="Up to 11 letters/numbers, or your Tall Bob virtual number"><input className="control-input h-11" value={f.sender_id} onChange={(e) => setF({ ...f, sender_id: e.target.value })} placeholder="e.g. Summernats" /></Field>
        <Field label="Environment"><select className="control-input h-11" value={f.environment} onChange={(e) => setF({ ...f, environment: e.target.value })}><option value="production">Production (real texts)</option><option value="sandbox">Test (Tall Bob sandbox)</option></select></Field>
        <Field label="SMS for this event">
          <label className="flex h-11 items-center gap-2 text-sm"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> SMS enabled</label>
        </Field>
      </div>

      <div className="mt-4 rounded-md border border-border p-3">
        <p className="mb-2 text-sm font-semibold">API credentials</p>
        <div className="mb-3 flex flex-wrap gap-4 text-sm">
          {current?.credential_id && <label className="flex items-center gap-2"><input type="radio" checked={credMode === "keep"} onChange={() => setCredMode("keep")} /> Keep saved credentials</label>}
          <label className="flex items-center gap-2"><input type="radio" checked={credMode === "new"} onChange={() => setCredMode("new")} /> {current?.credential_id ? "Replace / rotate" : "Enter credentials"}</label>
          {linkable.length > 0 && <label className="flex items-center gap-2"><input type="radio" checked={credMode === "link"} onChange={() => setCredMode("link")} /> Use another event's account</label>}
        </div>
        {credMode === "keep" && <p className="text-sm text-muted-foreground">Saved securely{current?.credentials_updated_at ? ` on ${fmtDateTime(current.credentials_updated_at, tz)}` : ""}. They can't be viewed, only replaced.{sharedWith.length > 0 && ` Also used by: ${sharedWith.map((s) => eventName_(s.event_id)).join(", ")}.`}</p>}
        {credMode === "new" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="API username"><input className="control-input h-11" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
            <Field label="API key (password)"><input type="password" className="control-input h-11" autoComplete="new-password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} /></Field>
            <p className="text-xs text-muted-foreground sm:col-span-2">Find these in Tall Bob → Settings → API Credentials{f.environment === "sandbox" ? " (on app-test.tallbob.com)" : ""}. They're encrypted on save and never shown again.{sharedWith.length > 0 && " Replacing them here only changes this event."}</p>
          </div>
        )}
        {credMode === "link" && (
          <Field label="Share the Tall Bob account of"><select className="control-input h-11" value={linkEvent} onChange={(e) => setLinkEvent(e.target.value)}><option value="">— choose event —</option>{linkable.map((s) => <option key={s.event_id} value={s.event_id}>{eventName_(s.event_id)} · {s.account_name}</option>)}</select></Field>
        )}
      </div>

      <button className="primary-button mt-4 h-11" disabled={!!busy} onClick={save}>{busy === "save" ? "Saving…" : "Save SMS settings"}</button>

      {current?.credential_id && (
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <button className="secondary-button h-11" disabled={!!busy} onClick={() => test(false)}>{busy === "test" ? "Testing…" : "Test connection"}</button>
            <div className="min-w-[200px] flex-1"><Field label="Send a test text to"><input className="control-input h-11" inputMode="tel" placeholder="04xx xxx xxx" value={testMobile} onChange={(e) => setTestMobile(e.target.value)} /></Field></div>
            <button className="secondary-button h-11" disabled={!!busy} onClick={() => test(true)}>{busy === "sms" ? "Sending…" : "Send test SMS"}</button>
          </div>
          {t && (
            <div className={`rounded-md border p-3 text-sm ${t.ok ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}`}>
              <p className="font-semibold">{t.ok ? "Connection working" : "Connection failed"}</p>
              {t.error && <p className="mt-1">{t.error}</p>}
              <div className="mt-2">
                <Row label="Event" value={t.event} />
                <Row label="Account" value={t.account_name ?? "—"} />
                <Row label="Sender ID" value={t.sender_id ?? "—"} />
                <Row label="Environment" value={t.environment === "sandbox" ? "Test" : "Production"} />
                <Row label="Tested" value={fmtDateTime(t.at, tz)} />
                {t.balance != null && <Row label="Account balance" value={`$${Number(t.balance).toFixed(2)}${t.postpay ? " (postpaid)" : ""}`} />}
                {t.delivery_tracking && <Row label="Delivery tracking" value={t.delivery_tracking === "on" ? "On" : t.delivery_tracking} />}
                {t.test_sms && <Row label="Test text" value={t.test_sms.ok ? `Submitted to ${t.test_sms.to}` : `Not sent: ${t.test_sms.error}`} />}
              </div>
            </div>
          )}
        </div>
      )}

      {current && (
        <div className="mt-4 text-sm">
          <Row label="Connection status" value={<Pill status={current.connection_status} />} />
          <Row label="Last successful test" value={current.last_test_ok_at ? fmtDateTime(current.last_test_ok_at, tz) : "Never"} />
          <Row label="Last configuration update" value={`${fmtDateTime(current.updated_at, tz)}${current.updated_by_name ? ` · ${current.updated_by_name}` : ""}`} />
        </div>
      )}
      <div className="mt-3">{flash.node}</div>
    </Panel>
  );
}
