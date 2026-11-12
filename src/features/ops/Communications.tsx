import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime, fmtTime, groupVariations, requestKey } from "@/lib/roster";
import { checkEventAccount, MAX_SMS_LENGTH, planRecipients, type EventSmsSettings } from "@/lib/sms";
import { invokeFunction, useOps, type Variation } from "./OpsContext";
import { resolveGroup } from "./Guards";
import { Field, Page, Panel, Pill, Table, Tabs, useFlash } from "./ui";

type Audience = "individual" | "group" | "event" | "shift" | "zone" | "contractor" | "signed_on" | "variation";
const audienceLabel: Record<Audience, string> = {
  individual: "Individual / selected guards",
  group: "A guard group",
  event: "All guards at this event",
  shift: "Everyone on a shift time",
  zone: "Everyone signed on in a zone",
  contractor: "All guards of a security contractor",
  signed_on: "Everyone currently signed on",
  variation: "Guards affected by an approved variation",
};

type TemplateKey = "extension" | "reduction" | "position" | "location" | "redeploy" | "additional" | "cancellation" | "general";
const templateLabel: Record<TemplateKey, string> = {
  extension: "Shift extension", reduction: "Shift reduction", position: "Change of position", location: "Change of location",
  redeploy: "Redeployment", additional: "Additional shift", cancellation: "Shift cancellation", general: "General roster update",
};

type Msg = {
  id: string; body: string; audience_label: string; recipient_count: number; status: string; sent_by_name: string | null; created_at: string;
  event_id: string | null; provider_account: string | null; sender_id: string | null; provider_reference: string | null; error: string | null;
};
type Recip = { id: string; guard_id: string | null; phone: string | null; to_number: string | null; status: string; submission_status: string; provider_sms_id: string | null; error: string | null };

/** This event's own SMS settings and whether texts can be sent right now. */
function useEventSms(eventId: string | undefined) {
  const [settings, setSettings] = useState<EventSmsSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
    if (!eventId) return;
    supabase.from("event_sms_settings").select("*").eq("event_id", eventId).maybeSingle().then(({ data }) => { setSettings(data as EventSmsSettings | null); setLoaded(true); });
  }, [eventId]);
  return { settings, loaded, check: checkEventAccount(eventId, settings) };
}

export function CommunicationsPage() {
  const { event, can } = useOps();
  const [tab, setTab] = useState<"compose" | "history">("compose");
  const sms = useEventSms(event?.id);
  return (
    <Page>
      <Tabs tabs={[{ id: "compose", label: "Send message" }, { id: "history", label: "SMS history" }]} value={tab} onChange={setTab} />
      {sms.loaded && (sms.check.ok ? (
        <p className="rounded-md border border-success/40 bg-success/10 p-3 text-sm">
          Texts for <b>{event?.name}</b> send from <b>{sms.settings?.sender_id}</b> using this event's Tall Bob account <b>{sms.settings?.account_name}</b>{sms.settings?.environment === "sandbox" ? " (test environment — no real texts)" : ""}.
        </p>
      ) : (
        <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm">
          <b>Texts can't be sent for {event?.name ?? "this event"}.</b> {sms.check.error}
          {can("manage_sms") && <> <Link className="font-semibold underline" to="/admin/settings">Open Settings</Link></>}
        </p>
      ))}
      {tab === "compose" ? <Compose ready={sms.check.ok} onSent={() => setTab("history")} /> : <History />}
    </Page>
  );
}

function Compose({ ready, onSent }: { ready: boolean; onSent: () => void }) {
  const ctx = useOps();
  const { guards, contractors, slots, attendance, variations, event, isManager, myContractorIds, now } = ctx;
  const [params] = useSearchParams();
  const tz = event?.timezone ?? "Australia/Sydney";
  const [aud, setAud] = useState<Audience>(params.get("variation") ? "variation" : "individual");
  const [pick, setPick] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [groupId, setGroupId] = useState("");
  const [shiftKey, setShiftKey] = useState("");
  const [zone, setZone] = useState("");
  const [variationId, setVariationId] = useState(params.get("variation") ?? "");
  const [contractorId, setContractorId] = useState("");
  const [body, setBody] = useState("");
  const [groups, setGroups] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<Record<string, string[]>>({});
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID());
  const [sending, setSending] = useState(false);
  const flash = useFlash();

  useEffect(() => {
    supabase.from("guard_groups").select("*").then(({ data }) => setGroups(data ?? []));
    supabase.from("guard_group_members").select("group_id,guard_id").then(({ data }) => {
      const m: Record<string, string[]> = {};
      (data ?? []).forEach((r: any) => (m[r.group_id] ||= []).push(r.guard_id));
      setGroupMembers(m);
    });
  }, []);

  const scopedGuards = isManager ? guards : guards.filter((g) => g.contractor_id && myContractorIds.includes(g.contractor_id));
  const scopeIds = new Set(scopedGuards.map((g) => g.id));
  const eventAttendance = attendance.filter((a) => a.event_id === event?.id);
  const shiftTimes = useMemo(() => [...new Set(slots.filter((s) => new Date(s.current_end) > now).map((s) => `${s.current_start}|${s.current_end}`))].sort(), [slots, now]);
  const zones = useMemo(() => [...new Set(slots.map((s) => s.zone).filter(Boolean))].sort(), [slots]);
  const approvedRequests = groupVariations(variations.filter((v) => v.status === "approved"));
  /** All approved shifts in the same request as the chosen variation. */
  const requestOf = (id: string) => { const v = variations.find((x) => x.id === id); return v ? variations.filter((x) => x.status === "approved" && requestKey(x) === requestKey(v)) : []; };

  /** Fills a template from the chosen variation and the current approved roster; unknown details stay in [brackets] to edit. */
  const buildTemplate = (key: TemplateKey, v: Variation | null): string => {
    const ref = v ? ` (${v.ref})` : "";
    const p = v?.proposed ?? {};
    const slot = v ? slots.find((s) => s.id === v.slot_id) : undefined;
    const multi = v ? requestOf(v.id).length > 1 : false;
    const t = (iso?: string) => (iso ? fmtTime(iso, tz) : "");
    const start = t(slot?.current_start ?? p.start) || "[start]";
    const finish = multi ? "" : t(slot?.current_end ?? p.end) || "[new finish time]";
    const position = p.position ?? slot?.position ?? "[position]";
    const zoneName = p.zone ?? slot?.zone ?? "[zone]";
    switch (key) {
      case "extension": return multi ? `Hi {name}, your shift has been extended${ref}. Please check the guard app for your new finish time — your automatic sign-off follows it.` : `Hi {name}, your shift has been extended${ref}. New finish time: ${finish}. Your automatic sign-off moves to match.`;
      case "reduction": return multi ? `Hi {name}, your shift has been shortened${ref}. Please check the guard app for your new finish time — you'll be signed off automatically then.` : `Hi {name}, your shift has been shortened${ref}. New finish time: ${finish}. You'll be signed off automatically at that time.`;
      case "position": return `Hi {name}, your position has changed${ref}. Please report to ${position} (${zoneName}).`;
      case "location": return `Hi {name}, your work location has changed${ref}. Please go to ${zoneName} — ${position}.`;
      case "redeploy": return `Hi {name}, you are redeployed${ref} to ${position} (${zoneName})${p.until ? ` until ${t(p.until)}, then return to your original post` : ""}. Please report there now.`;
      case "additional": return `Additional shifts available${ref}: ${p.count ?? "[number]"} × ${position} ${t(p.start) || "[start]"}–${t(p.end) || "[finish]"}. Reply to your contractor manager if you can work.`;
      case "cancellation": return `Hi {name}, your shift ${start}–${finish || "[finish]"} at ${position} has been cancelled. Please contact your contractor manager.`;
      default: return `Hi {name}, there's an update to the roster${ref}. Please check the guard app for your current shift details.`;
    }
  };
  const selectedVariation = variations.find((x) => x.id === variationId) ?? null;

  useEffect(() => {
    const v = selectedVariation;
    if (!v || body) return;
    if (v.variation_type === "time") setBody(buildTemplate(new Date(v.proposed?.end) < new Date(v.original?.end) ? "reduction" : "extension", v));
    else if (v.variation_type === "redeploy") setBody(buildTemplate("redeploy", v));
    else setBody(buildTemplate("additional", v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variationId, variations]);

  const recipients = useMemo(() => {
    let ids: string[] = [];
    const open = attendance.filter((a) => !a.signed_off_at);
    if (aud === "individual") ids = pick;
    if (aud === "group") { const g = groups.find((x) => x.id === groupId); ids = g ? resolveGroup(g, groupMembers[g.id] ?? [], ctx) : []; }
    if (aud === "event") ids = eventAttendance.map((a) => a.guard_id);
    if (aud === "shift") { const [st, en] = shiftKey.split("|"); const sids = new Set(slots.filter((s) => s.current_start === st && s.current_end === en).map((s) => s.id)); ids = open.filter((a) => a.slot_id && sids.has(a.slot_id)).map((a) => a.guard_id); }
    if (aud === "zone") { const sids = new Set(slots.filter((s) => s.zone === zone).map((s) => s.id)); ids = zone ? open.filter((a) => a.slot_id && sids.has(a.slot_id)).map((a) => a.guard_id) : []; }
    if (aud === "signed_on") ids = open.map((a) => a.guard_id);
    if (aud === "contractor") ids = guards.filter((g) => g.contractor_id === contractorId).map((g) => g.id);
    if (aud === "variation") {
      const req = requestOf(variationId);
      const affected = new Set(slots.filter((s) => req.some((v) => s.id === v.slot_id || s.id === v.proposed?.target_slot_id || s.source_variation_id === v.id)).map((s) => s.id));
      ids = open.filter((a) => a.slot_id && affected.has(a.slot_id)).map((a) => a.guard_id);
    }
    return [...new Set(ids)].filter((id) => scopeIds.has(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aud, pick, groupId, shiftKey, zone, contractorId, variationId, slots, attendance, guards, groups, groupMembers]);

  const gmap = useMemo(() => new Map(guards.map((g) => [g.id, g])), [guards]);
  const plan = useMemo(() => planRecipients(recipients.map((id) => ({ id, phone: gmap.get(id)?.phone ?? null }))), [recipients, gmap]);

  const audienceText = () => {
    if (aud === "group") return `Group: ${groups.find((g) => g.id === groupId)?.name ?? ""}`;
    if (aud === "variation") return `Affected by ${selectedVariation?.ref ?? ""}`;
    if (aud === "contractor") return `Contractor: ${contractors.find((c) => c.id === contractorId)?.name ?? ""}`;
    if (aud === "zone") return `Signed on in ${zone}`;
    if (aud === "shift") { const [st, en] = shiftKey.split("|"); return `Shift ${st ? fmtTime(st, tz) : ""}–${en ? fmtTime(en, tz) : ""}`; }
    return audienceLabel[aud];
  };

  const send = async () => {
    if (!event) return;
    if (!ready) return flash.show("SMS isn't set up for this event yet.", true);
    if (!body.trim()) return flash.show("Write a message.", true);
    if (!plan.send.length) return flash.show("No recipients with a valid mobile number.", true);
    setSending(true);
    const { data, error } = await invokeFunction("send-sms", {
      event_id: event.id, body: body.trim(), audience_label: audienceText().slice(0, 200), guard_ids: recipients,
      variation_id: aud === "variation" && selectedVariation ? selectedVariation.id : null, client_key: clientKey,
    });
    setSending(false);
    if (error && !data?.message_id) return flash.show(error, true);
    if (data?.duplicate) { flash.show("This message was already sent — it hasn't been sent again."); return; }
    setClientKey(crypto.randomUUID());
    setBody(""); setPick([]);
    if (data.status === "failed") return flash.show(`Not sent: ${data.error ?? "Tall Bob refused the message."}`, true);
    onSent();
  };

  const segments = Math.max(1, Math.ceil(body.length / 160));
  const count = plan.send.length;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
      <Panel title="Recipients">
        <div className="space-y-3">
          <Field label="Send to"><select className="control-input h-11" value={aud} onChange={(e) => setAud(e.target.value as Audience)}>{(Object.keys(audienceLabel) as Audience[]).map((a) => <option key={a} value={a}>{audienceLabel[a]}</option>)}</select></Field>
          {aud === "individual" && (
            <>
              <input className="control-input h-10" placeholder="Search guards…" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {scopedGuards.filter((g) => !q || `${g.name} ${g.employee_id} ${g.phone}`.toLowerCase().includes(q.toLowerCase())).slice(0, 200).map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pick.includes(g.id)} onChange={(e) => setPick(e.target.checked ? [...pick, g.id] : pick.filter((x) => x !== g.id))} />{g.name} <span className="text-muted-foreground">{g.phone}</span></label>
                ))}
              </div>
            </>
          )}
          {aud === "group" && <select className="control-input h-11" value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">— choose group —</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>}
          {aud === "event" && <p className="text-xs text-muted-foreground">Every guard who has been signed on at {event?.name ?? "this event"}.</p>}
          {aud === "shift" && <select className="control-input h-11" value={shiftKey} onChange={(e) => setShiftKey(e.target.value)}><option value="">— choose shift time —</option>{shiftTimes.map((k) => { const [s, e] = k.split("|"); return <option key={k} value={k}>{fmtDateTime(s, tz)} – {fmtTime(e, tz)}</option>; })}</select>}
          {aud === "zone" && <select className="control-input h-11" value={zone} onChange={(e) => setZone(e.target.value)}><option value="">— choose zone —</option>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</select>}
          {aud === "contractor" && <select className="control-input h-11" value={contractorId} onChange={(e) => setContractorId(e.target.value)}><option value="">— choose —</option>{contractors.filter((c) => isManager || myContractorIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
          {aud === "variation" && <select className="control-input h-11" value={variationId} onChange={(e) => { setVariationId(e.target.value); setBody(""); }}><option value="">— choose approved variation —</option>{approvedRequests.map((g) => <option key={g[0].id} value={g[0].id}>{g[0].ref}{g.length > 1 ? ` (${g.length} shifts)` : ""} · {g[0].reason}</option>)}</select>}
          <div className="rounded-md bg-secondary/50 p-3 text-sm">
            <p className="font-semibold">{count} recipient{count === 1 ? "" : "s"} will get this text</p>
            {(plan.invalid.length > 0 || plan.duplicate.length > 0) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {plan.invalid.length > 0 && `${plan.invalid.length} without a valid Australian mobile (skipped). `}
                {plan.duplicate.length > 0 && `${plan.duplicate.length} duplicate number${plan.duplicate.length === 1 ? "" : "s"} removed.`}
              </p>
            )}
          </div>
        </div>
      </Panel>
      <Panel title="Message">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">{(Object.keys(templateLabel) as TemplateKey[]).map((k) => <button key={k} className="secondary-button h-9 text-xs" onClick={() => setBody(buildTemplate(k, selectedVariation))}>{templateLabel[k]}</button>)}</div>
          {selectedVariation && <p className="text-xs text-muted-foreground">Templates use details from {selectedVariation.ref} and the current roster. Check and edit before sending.</p>}
          <textarea className="control-input min-h-[160px] py-3" maxLength={MAX_SMS_LENGTH} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type your message… {name} is replaced with each guard's first name." />
          <p className="text-xs text-muted-foreground">{body.length} characters · about {segments} SMS segment{segments > 1 ? "s" : ""} per recipient</p>
          <button className="primary-button h-12 w-full" disabled={!ready || sending || count === 0} onClick={send}>{sending ? "Sending…" : `Send SMS to ${count} guard${count === 1 ? "" : "s"}`}</button>
          {flash.node}
        </div>
      </Panel>
    </div>
  );
}

function History() {
  const { event, events, guardName } = useOps();
  const [rows, setRows] = useState<Msg[]>([]);
  const [scope, setScope] = useState<"event" | "all">("event");
  const [open, setOpen] = useState<string | null>(null);
  const [recips, setRecips] = useState<Record<string, Recip[]>>({});
  const tz = event?.timezone ?? "Australia/Sydney";
  const eventName = (id: string | null) => (id ? events.find((e) => e.id === id)?.name ?? "—" : "—");

  const load = async () => {
    let q = supabase.from("sms_messages").select("id,body,audience_label,recipient_count,status,sent_by_name,created_at,event_id,provider_account,sender_id,provider_reference,error").order("created_at", { ascending: false }).limit(200);
    if (scope === "event" && event) q = q.eq("event_id", event.id);
    const { data } = await q;
    setRows((data ?? []) as Msg[]);
    if (open) loadRecipients(open);
  };
  const loadRecipients = async (id: string) => {
    const { data } = await supabase.from("sms_recipients").select("id,guard_id,phone,to_number,status,submission_status,provider_sms_id,error").eq("message_id", id).limit(1000);
    setRecips((r) => ({ ...r, [id]: (data ?? []) as Recip[] }));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [scope, event?.id]);

  return (
    <Panel title="SMS history" actions={
      <div className="flex gap-2">
        <select className="control-input h-9" value={scope} onChange={(e) => setScope(e.target.value as "event" | "all")}><option value="event">This event</option><option value="all">All events</option></select>
        <button className="secondary-button h-9" onClick={load}>Refresh</button>
      </div>
    }>
      <Table head={["Date", "Event", "Account / sender", "Sent by", "Audience", "Recipients", "Message", "Status"]} empty={rows.length === 0}>
        {rows.map((m) => (
          <Fragment key={m.id}>
            <tr className="cursor-pointer hover:bg-secondary/40" onClick={() => { const next = open === m.id ? null : m.id; setOpen(next); if (next) loadRecipients(next); }}>
              <td className="whitespace-nowrap px-3 py-2">{fmtDateTime(m.created_at, tz)}</td>
              <td className="px-3 py-2">{eventName(m.event_id)}</td>
              <td className="px-3 py-2">{m.provider_account ?? "—"}<span className="block text-xs text-muted-foreground">{m.sender_id ?? ""}</span></td>
              <td className="px-3 py-2">{m.sent_by_name}</td>
              <td className="px-3 py-2">{m.audience_label}</td>
              <td className="px-3 py-2 tabular-nums">{m.recipient_count}</td>
              <td className="max-w-[280px] truncate px-3 py-2">{m.body}</td>
              <td className="px-3 py-2"><Pill status={m.status} />{m.error && <span className="mt-1 block max-w-[220px] text-xs text-danger">{m.error}</span>}</td>
            </tr>
            {open === m.id && (
              <tr>
                <td colSpan={8} className="bg-secondary/30 px-3 py-3">
                  <p className="mb-2 text-xs text-muted-foreground">Internal reference: <span className="font-mono">{m.provider_reference ?? "—"}</span></p>
                  <p className="mb-3 whitespace-pre-wrap text-sm">{m.body}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left uppercase tracking-wide text-muted-foreground"><tr>{["Recipient", "Guard", "Tall Bob SMS ID", "Submission", "Delivery", "Error"].map((h) => <th key={h} className="px-2 py-1 font-semibold">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-border">
                        {(recips[m.id] ?? []).map((r) => (
                          <tr key={r.id}>
                            <td className="px-2 py-1 tabular-nums">{r.to_number ? `+${r.to_number}` : r.phone ?? "—"}</td>
                            <td className="px-2 py-1">{r.guard_id ? guardName(r.guard_id) : "Staff / test"}</td>
                            <td className="px-2 py-1 font-mono">{r.provider_sms_id ?? "—"}</td>
                            <td className="px-2 py-1"><Pill status={r.submission_status} /></td>
                            <td className="px-2 py-1"><Pill status={r.status} /></td>
                            <td className="px-2 py-1 text-danger">{r.error ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </Table>
    </Panel>
  );
}
