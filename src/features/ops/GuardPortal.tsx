import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { canDeleteOwnAccount, effectiveDeployment, fmtDateTime, fmtTime, isDeleteConfirmation, type Slot } from "@/lib/roster";
import { errMsg, invokeFunction } from "./OpsContext";
import { Field, Row, Tabs, useFlash } from "./ui";
import { QRCodeSVG } from "qrcode.react";
import { guardQrValue } from "./QrScanner";
import { GuardLocation } from "./GuardLocation";

type Tab = "shift" | "sign" | "changes" | "messages" | "profile";

/**
 * Guard passes must stay black-on-white so scanners can read them, whatever the theme.
 * Encoded uppercase (QR alphanumeric mode = fewer, larger modules) with low error correction
 * and a 4-module quiet zone so desk scanners read phone screens fast; scanners lowercase the id.
 */
function GuardPass({ guardId, size = 260 }: { guardId: string; size?: number }) {
  return (
    <div className="rounded-md bg-[#fff] p-2">
      <QRCodeSVG value={guardQrValue(guardId).toUpperCase()} size={size} level="L" marginSize={4} bgColor="#ffffff" fgColor="#000000" style={{ width: "min(80vw, " + size + "px)", height: "auto" }} />
    </div>
  );
}

/** Provider names for the self-registration picker (no contact details). */
export function useSignupProviders() {
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { supabase.rpc("list_signup_providers").then(({ data }) => setProviders((data as any) ?? [])); }, []);
  return providers;
}

export function GuardPortal({ session }: { session: Session | null }) {
  const [tab, setTab] = useState<Tab>("shift");
  const [guard, setGuard] = useState<any>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [event, setEvent] = useState<any>(null);
  const [contractor, setContractor] = useState<string>("");
  const [att, setAtt] = useState<any>(null);
  const [changes, setChanges] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);

  // Guards are linked to positions only by signing on at the desk, so "my shift" is the position of the open sign-on.
  const load = useCallback(async () => {
    if (!session) return;
    const { data: g } = await supabase.from("guards").select("*").eq("user_id", session.user.id).maybeSingle();
    setGuard(g);
    if (!g) return;
    const { data: a } = await supabase.from("attendance").select("*").eq("guard_id", g.id).is("signed_off_at", null).maybeSingle();
    setAtt(a);
    const s = a?.slot_id ? ((await supabase.from("roster_slots").select("*").eq("id", a.slot_id).maybeSingle()).data as unknown as Slot | null) : null;
    setSlot(s);
    const cid = s?.contractor_id ?? g.contractor_id;
    const [{ data: e }, { data: c }, { data: log }] = await Promise.all([
      s ? supabase.from("events").select("*").eq("id", s.event_id).maybeSingle() : Promise.resolve({ data: null }),
      cid ? supabase.from("contractors").select("name").eq("id", cid).maybeSingle() : Promise.resolve({ data: null }),
      s ? supabase.from("roster_change_log").select("*").eq("slot_id", s.id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
    setEvent(e); setContractor((c as any)?.name ?? ""); setChanges((log as any[]) ?? []);
    const { data: r } = await supabase.from("sms_recipients").select("message_id, sms_messages(body, created_at, sent_by_name)").eq("guard_id", g.id).limit(50);
    setMsgs((r ?? []).map((x: any) => x.sms_messages).filter(Boolean));
  }, [session]);

  useEffect(() => { load(); }, [load]);

  // Live refresh: approved variations update the slot and change log; RLS limits events to this guard's rows.
  const [alert, setAlert] = useState<string | null>(null);
  const slotId = slot?.id ?? null;
  useEffect(() => {
    if (!guard) return;
    const ch = supabase.channel(`guard-${guard.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance", filter: `guard_id=eq.${guard.id}` }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sms_recipients", filter: `guard_id=eq.${guard.id}` }, () => load());
    if (slotId) {
      ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "roster_slots", filter: `id=eq.${slotId}` }, () => load())
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "roster_change_log", filter: `slot_id=eq.${slotId}` }, (p: any) => {
          setAlert(p.new?.summary ?? "Your shift has changed");
          if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
          load();
        });
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [guard?.id, slotId, load]);

  if (!session) return <div className="space-y-4 p-4">{new URLSearchParams(window.location.search).get("deleted") === "1" && <p role="status" className="panel p-5 font-semibold">Your account has been deleted.</p>}<p className="panel p-5">Please log in to see your shift.</p><Link to="/mobile/login" className="primary-button h-14 w-full">Guard login</Link><Link to="/mobile/onboarding" className="secondary-button h-14 w-full">New guard? Register</Link></div>;
  if (!guard) return <div className="space-y-4 p-4"><p className="panel p-5">No guard profile is linked to this account yet.</p><Link to="/mobile/profile" className="primary-button h-14 w-full">Create guard profile</Link></div>;

  const tz = event?.timezone ?? "Australia/Sydney";
  const d = slot ? effectiveDeployment(slot, new Date()) : null;

  return (
    <div className="space-y-4 p-4">
      {alert && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-warning bg-warning/15 p-4">
          <div><p className="font-bold">Your shift has changed</p><p className="text-sm">{alert}</p></div>
          <button className="secondary-button h-9 px-3" onClick={() => { setAlert(null); setTab("shift"); }}>Got it</button>
        </div>
      )}
      <Tabs tabs={[{ id: "shift", label: "My shift" }, { id: "sign", label: "Sign-on" }, { id: "changes", label: "Changes", count: changes.length }, { id: "messages", label: "Messages", count: msgs.length }, { id: "profile", label: "Profile" }]} value={tab} onChange={setTab} />
      {tab === "shift" && (
        <section className="panel p-5">
          {!slot || !d ? <>
            <p className="font-semibold">You're not on a position yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">When you arrive, show your guard pass at the sign-in desk. They'll put you on a position and your shift details will appear here.</p>
            <button className="secondary-button mt-4 h-12 w-full" onClick={() => setTab("sign")}>Show my guard pass</button>
          </> : <>
            <h2 className="mb-3 text-2xl font-bold">{d.position}</h2>
            <Row label="Event" value={event?.name ?? "—"} />
            <Row label="Time" value={`${fmtDateTime(slot.current_start, tz)} – ${fmtTime(slot.current_end, tz)}`} />
            <Row label="Role" value={d.role} />
            <Row label="Location" value={d.zone} />
            {d.temporary && <Row label="Temporary until" value={fmtTime(d.until!, tz)} />}
            <Row label="Contractor" value={contractor || "—"} />
            <Row label="Instructions" value={slot.scope || "—"} />
            {slot.notes && <Row label="Notes" value={slot.notes} />}
          </>}
        </section>
      )}
      {tab === "shift" && att && slot && <GuardLocation eventId={slot.event_id} eventName={event?.name ?? ""} tz={tz} />}
      {tab === "shift" && att && !slot && <p className="panel p-4 text-sm text-muted-foreground">Signed on — location sharing becomes available once the desk puts you on a position.</p>}
      {tab === "sign" && (
        <section className="panel space-y-4 p-5">
          <p className="text-lg font-bold">{att ? "You are signed on" : "You are not signed on"}</p>
          {att && <p className="text-sm text-muted-foreground">Since {fmtTime(att.signed_on_at, tz)}{d ? ` · ${d.position}` : " · Not yet on a position — see the sign-in desk"}</p>}
          {slot && <p className="text-sm">Automatic sign-off: <b>{fmtTime(slot.current_end, tz)}</b></p>}
          {att
            ? <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">You'll be signed off automatically when your shift ends. If your shift is changed, this time updates.</p>
            : <div className="flex flex-col items-center gap-2 rounded-md border border-border p-4">
                <GuardPass guardId={guard.id} size={280} />
                <p className="text-center text-sm font-semibold">Show this at the sign-in desk to be signed on</p>
                <p className="text-center text-xs text-muted-foreground">Sign-on is done by your security provider at the desk — you can't sign yourself on from your phone.</p>
              </div>}
        </section>
      )}
      {tab === "changes" && (
        <section className="panel space-y-3 p-5">
          {changes.length === 0 ? <p className="text-muted-foreground">No changes to your shift.</p> : changes.map((c) => <div key={c.id} className="border-b border-border pb-2"><p className="font-semibold">{c.summary}</p><p className="text-xs text-muted-foreground">{fmtDateTime(c.created_at, tz)}</p></div>)}
        </section>
      )}
      {tab === "messages" && (
        <section className="panel space-y-3 p-5">
          {msgs.length === 0 ? <p className="text-muted-foreground">No messages.</p> : msgs.map((m, i) => <div key={i} className="border-b border-border pb-2"><p>{String(m.body).replace("{name}", guard.name.split(" ")[0])}</p><p className="text-xs text-muted-foreground">{fmtDateTime(m.created_at, tz)} · {m.sent_by_name}</p></div>)}
        </section>
      )}
      {tab === "profile" && <Profile guard={guard} provider={contractor} onSaved={load} />}
      {tab === "profile" && <DeleteAccount signedOn={!!att} />}
    </div>
  );
}

function Profile({ guard, provider, onSaved }: { guard: any; provider: string; onSaved: () => void }) {
  const [f, setF] = useState({ phone: guard.phone, email: guard.email, licence_number: guard.licence_number, emergency_contact: guard.emergency_contact });
  const [pick, setPick] = useState("");
  const providers = useSignupProviders();
  const flash = useFlash();
  const save = async () => {
    const patch = !guard.contractor_id && pick ? { ...f, contractor_id: pick } : f;
    const { error } = await supabase.from("guards").update(patch).eq("id", guard.id);
    if (error) flash.show(errMsg(error), true); else { flash.show("Saved."); onSaved(); }
  };
  return (
    <section className="panel space-y-3 p-5">
      <p className="text-lg font-bold">{guard.name}</p>
      <p className="text-sm text-muted-foreground">Employee ID {guard.employee_id}</p>
      <div className="flex flex-col items-center gap-2 rounded-md border border-border p-4">
        <GuardPass guardId={guard.id} />
        <p className="text-sm font-semibold">My guard pass</p>
        <p className="text-center text-xs text-muted-foreground">Show this at the sign-in desk to be signed on to your position.</p>
      </div>
      {guard.contractor_id
        ? <Row label="Security provider" value={provider || "—"} />
        : <Field label="Security provider (who you work for)">
            <select className="control-input h-12" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose your provider…</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>}
      {(["phone", "email", "licence_number", "emergency_contact"] as const).map((k) => (
        <Field key={k} label={k === "licence_number" ? "Security licence" : k === "emergency_contact" ? "Emergency contact" : k[0].toUpperCase() + k.slice(1)}>
          <input className="control-input h-12" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        </Field>
      ))}
      <button className="primary-button h-12 w-full" onClick={save}>Save</button>
      {flash.node}
    </section>
  );
}

/** App-store-required account deletion. The server refuses while signed on and keeps past shift records. */
function DeleteAccount({ signedOn }: { signedOn: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const allowed = canDeleteOwnAccount({ isGuard: true, signedOn });

  const remove = async () => {
    setBusy(true); setError("");
    const { error } = await invokeFunction("delete-my-account", {});
    if (error) { setBusy(false); setError(error); return; }
    await supabase.auth.signOut().catch(() => undefined);
    navigate("/mobile?deleted=1", { replace: true });
  };

  return (
    <section className="panel space-y-3 p-5" aria-labelledby="delete-title">
      <h3 id="delete-title" className="text-lg font-bold">Delete my account</h3>
      {!allowed ? (
        <p className="text-sm text-muted-foreground">You're signed on to a shift. You can delete your account once you've been signed off.</p>
      ) : !open ? (
        <>
          <p className="text-sm text-muted-foreground">Permanently delete your login and personal details from OTG Event Security.</p>
          <button className="secondary-button h-12 w-full text-danger" onClick={() => setOpen(true)}>Delete my account</button>
        </>
      ) : (
        <div className="space-y-3 rounded-md border border-danger bg-[hsl(var(--danger)/0.08)] p-3 text-sm">
          <p className="font-semibold">This can't be undone.</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Your login is deleted and you're signed out straight away.</li>
            <li>Your phone, email, licence number, emergency contact, photo and any location data are deleted.</li>
            <li>Your guard pass stops working.</li>
            <li>Your name and employee ID stay on past shift records, which your security provider needs for hours and pay.</li>
            <li>To work again later, register as a new guard.</li>
          </ul>
          <label className="block space-y-1">
            <span className="font-semibold">Type DELETE to confirm</span>
            <input className="control-input h-12 w-full" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" aria-label="Type DELETE to confirm" />
          </label>
          {error && <p className="text-danger" role="alert">{error}</p>}
          <button className="inline-flex h-12 w-full items-center justify-center rounded-md bg-danger font-semibold text-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !isDeleteConfirmation(typed)} onClick={remove}>{busy ? "Deleting…" : "Permanently delete my account"}</button>
          <button className="secondary-button h-10 w-full" disabled={busy} onClick={() => { setOpen(false); setTyped(""); setError(""); }}>Cancel</button>
        </div>
      )}
    </section>
  );
}
