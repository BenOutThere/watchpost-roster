import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_LOCATION_SETTINGS, fmtAge, pastCutoff, shouldUpload, type LocationSettings } from "@/lib/location";
import { fmtTime } from "@/lib/roster";
import { errMsg } from "./OpsContext";
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

/** In the installed phone app, location keeps flowing with the screen locked (OS foreground service + notification). */
const NATIVE = Capacitor.isNativePlatform();
const BgGeo = NATIVE ? registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation") : null;

type Status = "off" | "waiting" | "active" | "paused" | "denied" | "unavailable" | "offline" | "stopped";
const STATUS_TEXT: Record<Status, string> = {
  off: "Not sharing",
  waiting: "Waiting for location…",
  active: "Sharing active",
  paused: "Paused — screen hidden",
  denied: "Permission denied",
  unavailable: "Location unavailable",
  offline: "Connection unavailable",
  stopped: "Sharing stopped",
};
const STOP_TEXT: Record<string, string> = {
  signed_off: "You've been signed off, so sharing stopped.",
  shift_ended: "Your shift has ended, so sharing stopped.",
  consent_withdrawn: "You withdrew consent.",
  another_device: "Sharing was started on another phone.",
  disabled_for_event: "Location sharing was turned off for this event.",
  guard_stopped: "You stopped sharing.",
};

/** Device id so only one phone at a time can share for a guard. Not a credential. */
function deviceId() {
  let id = localStorage.getItem("ot-device-id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("ot-device-id", id); }
  return id;
}

/** Called before a guard logs out so their phone stops being shown. */
export async function stopSharingOnLogout() {
  try { await supabase.rpc("stop_location_sharing", { _withdraw_consent: false, _reason: "logout" }); } catch { /* ignore */ }
}

export function GuardLocation({ eventId, eventName, tz }: { eventId: string; eventName: string; tz: string }) {
  const [settings, setSettings] = useState<LocationSettings>(DEFAULT_LOCATION_SETTINGS);
  const [consented, setConsented] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [status, setStatus] = useState<Status>("off");
  const [note, setNote] = useState<string | null>(null);
  const [lastUpload, setLastUpload] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);

  const session = useRef<{ id: string; expiresAt: string } | null>(null);
  const watchId = useRef<number | null>(null);
  const pending = useRef<GeolocationPosition | null>(null);
  const lastSent = useRef<{ captured: number | null; at: number | null }>({ captured: null, at: null });
  const lastReadingAt = useRef(0);
  const sending = useRef(false);

  const nativeWatch = useRef<string | null>(null);
  const clearWatch = () => {
    if (watchId.current != null && watchId.current !== -1) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    if (nativeWatch.current && BgGeo) { BgGeo.removeWatcher({ id: nativeWatch.current }); nativeWatch.current = null; }
  };

  const end = useCallback((reason: string | null) => {
    clearWatch(); pending.current = null; session.current = null;
    setStatus(reason ? "stopped" : "off");
    if (reason) setNote(STOP_TEXT[reason] ?? "Sharing stopped.");
  }, []);

  const upload = useCallback(async (force = false) => {
    const s = session.current, p = pending.current;
    if (!s || !p || sending.current) return;
    if (pastCutoff(s.expiresAt, new Date())) return end("shift_ended");
    if (!shouldUpload({ lastSentCapturedAt: lastSent.current.captured, lastSentAt: lastSent.current.at, capturedAt: p.timestamp, now: Date.now(), intervalS: settings.upload_interval_s, force })) return;
    sending.current = true;
    const { data, error } = await supabase.rpc("submit_guard_location", {
      _session_id: s.id, _lat: p.coords.latitude, _lng: p.coords.longitude, _accuracy: p.coords.accuracy,
      _captured_at: new Date(p.timestamp).toISOString(), _sample_id: `${s.id}:${p.timestamp}`,
    });
    sending.current = false;
    if (error) { setStatus("offline"); return; } // keep only this latest reading; retried on next tick after eligibility is rechecked server-side
    const r = data as { ok: boolean; stop?: boolean; reason?: string; expires_at?: string };
    if (r.stop) return end(r.reason ?? "stopped");
    if (r.expires_at && session.current) session.current.expiresAt = r.expires_at;
    if (r.ok || r.reason === "out_of_order") {
      lastSent.current = { captured: p.timestamp, at: Date.now() };
      if (pending.current === p) pending.current = null;
      if (r.ok) { setLastUpload(new Date().toISOString()); setStatus("active"); }
    }
  }, [settings.upload_interval_s, end]);

  const onPos = useCallback((p: GeolocationPosition) => { pending.current = p; lastReadingAt.current = Date.now(); upload(); }, [upload]);
  const onErr = useCallback((e: GeolocationPositionError) => {
    if (e.code === e.PERMISSION_DENIED) { clearWatch(); setStatus("denied"); }
    else setStatus((s) => (s === "active" ? s : "unavailable"));
  }, []);
  const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 };

  const beginWatch = useCallback(() => {
    if (BgGeo) {
      clearWatch();
      setStatus((s) => (s === "active" ? s : "waiting"));
      watchId.current = -1; // marks "watching" for the tick
      BgGeo.addWatcher({
        backgroundMessage: "Sharing your location with event control until your shift ends.",
        backgroundTitle: "Location sharing on",
        requestPermissions: true, stale: false, distanceFilter: 10,
      }, (loc, err) => {
        if (err) { if (err.code === "NOT_AUTHORIZED") { clearWatch(); setStatus("denied"); } else setStatus((s) => (s === "active" ? s : "unavailable")); return; }
        if (!loc) return;
        onPos({ timestamp: loc.time ?? Date.now(), coords: { latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy } } as unknown as GeolocationPosition);
      }).then((id) => { nativeWatch.current = id; });
      return;
    }
    if (!("geolocation" in navigator)) { setStatus("unavailable"); return; }
    clearWatch();
    setStatus((s) => (s === "active" ? s : "waiting"));
    navigator.geolocation.getCurrentPosition((p) => { pending.current = p; lastReadingAt.current = Date.now(); upload(true); }, onErr, { ...opts, maximumAge: 0 });
    watchId.current = navigator.geolocation.watchPosition(onPos, onErr, opts);
  }, [onPos, onErr, upload]);

  // Load settings, consent and any open session for this phone.
  useEffect(() => {
    (async () => {
      const [{ data: st }, { data: c }, { data: s }] = await Promise.all([
        supabase.from("event_location_settings").select("*").eq("event_id", eventId).maybeSingle(),
        supabase.from("guard_location_consents").select("notice_version").eq("event_id", eventId).is("withdrawn_at", null).maybeSingle(),
        supabase.from("guard_tracking_sessions").select("id, expires_at, device_id").is("stopped_at", null).maybeSingle(),
      ]);
      const set = { ...DEFAULT_LOCATION_SETTINGS, ...(st ?? {}) } as LocationSettings;
      setSettings(set);
      setConsented(!!c && c.notice_version === set.notice_version);
      if (s && s.device_id === deviceId()) { session.current = { id: s.id, expiresAt: s.expires_at }; setStatus("paused"); setNote("Tap Resume to carry on sharing from this phone."); }
    })();
    return () => clearWatch();
  }, [eventId]);

  // Tick: phone-side cutoff, fresh reading roughly every 60 s, retry pending reading.
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      const s = session.current;
      if (!s || watchId.current == null) return;
      if (pastCutoff(s.expiresAt, new Date())) return end("shift_ended");
      if (!NATIVE && Date.now() - lastReadingAt.current > 60_000) navigator.geolocation.getCurrentPosition(onPos, onErr, opts);
      upload();
    }, 5000);
    return () => clearInterval(t);
  }, [onPos, onErr, upload, end]);

  // Stop collecting when hidden; recheck eligibility before resuming.
  useEffect(() => {
    const onVis = async () => {
      if (!session.current || NATIVE) return; // the phone app keeps sharing in the background
      if (document.hidden) { clearWatch(); setStatus("paused"); return; }
      const { data } = await supabase.from("guard_tracking_sessions").select("stopped_at, stop_reason, expires_at").eq("id", session.current.id).maybeSingle();
      if (!data || data.stopped_at) return end(data?.stop_reason ?? "stopped");
      session.current.expiresAt = data.expires_at;
      beginWatch();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [beginWatch, end]);

  const start = async () => {
    setBusy(true); setNote(null);
    const { data, error } = await supabase.rpc("start_location_sharing", { _notice_version: settings.notice_version, _device_id: deviceId() });
    setBusy(false);
    if (error) { setNote(errMsg(error)); return; }
    const { data: s } = await supabase.from("guard_tracking_sessions").select("expires_at").eq("id", data as string).maybeSingle();
    session.current = { id: data as string, expiresAt: s?.expires_at ?? new Date().toISOString() };
    lastSent.current = { captured: null, at: null };
    setConsented(true); setShowNotice(false);
    beginWatch();
  };
  const stop = async (withdraw: boolean) => {
    setBusy(true);
    await supabase.rpc("stop_location_sharing", { _withdraw_consent: withdraw, _reason: withdraw ? "consent_withdrawn" : "guard_stopped" });
    setBusy(false);
    if (withdraw) setConsented(false);
    end(withdraw ? "consent_withdrawn" : "guard_stopped");
  };

  if (!settings.enabled) return null;
  const sharing = !!session.current && status !== "stopped";
  const tone = status === "active" ? "border-success bg-success/10" : ["denied", "unavailable", "offline"].includes(status) ? "border-warning bg-warning/10" : "border-border";

  return (
    <section className="panel space-y-3 p-5" aria-labelledby="loc-title">
      <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" aria-hidden /><h3 id="loc-title" className="text-lg font-bold">Location sharing</h3></div>
      <div className={`rounded-md border p-3 ${tone}`} role="status">
        <p className="font-semibold">{STATUS_TEXT[status]}</p>
        {lastUpload && <p className="text-xs text-muted-foreground">Last sent {fmtAge(lastUpload, now)}</p>}
        {session.current && <p className="text-xs text-muted-foreground">Stops automatically at {fmtTime(session.current.expiresAt, tz)}</p>}
        {status === "denied" && <p className="mt-1 text-sm">Your phone blocked location. Allow location for this site in your browser settings, then tap Start again. You're still signed on.</p>}
        {note && <p className="mt-1 text-sm">{note}</p>}
      </div>

      {showNotice && !sharing && (
        <div className="space-y-2 rounded-md border border-primary/50 bg-primary/5 p-3 text-sm">
          <p className="font-semibold">Before you share your location</p>
          {NATIVE && <p className="font-medium">OTG Event Security collects location data to show your position to event control during your signed-on shift, even when the app is closed or not in use.</p>}
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li><b>Why:</b> so the control room can see where guards are during {eventName || "this event"}.</li>
            <li><b>Who can see it:</b> event management, the control room and your security provider's managers.</li>
            <li><b>When:</b> only while you're signed on{NATIVE ? " (this keeps working with your phone locked or in your pocket — you'll see a notification)" : " and this screen is open"}. It stops when you're signed off, your shift ends, you log out or you tap Stop.</li>
            <li><b>What's kept:</b> only your latest location, deleted as soon as sharing stops. No location history is stored.</li>
            <li><b>Your choice:</b> you can stop or withdraw at any time. Not sharing doesn't affect your sign-on or pay.</li>
          </ul>
          <p className="text-xs text-muted-foreground">More detail in our <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline">privacy policy</a>.{NATIVE ? " Next, your phone will ask for location permission — tap Allow." : ""}</p>
          <button className="primary-button h-12 w-full" disabled={busy} onClick={start}>I agree — start sharing</button>
          <button className="secondary-button h-10 w-full" onClick={() => setShowNotice(false)}>Not now</button>
        </div>
      )}

      {!sharing && !showNotice && <button className="primary-button h-12 w-full" disabled={busy} onClick={() => (consented ? start() : setShowNotice(true))}>Start sharing location</button>}
      {sharing && status === "paused" && <button className="primary-button h-12 w-full" onClick={beginWatch}>Resume sharing</button>}
      {sharing && status !== "paused" && <button className="secondary-button h-12 w-full" onClick={() => { pending.current = null; navigator.geolocation.getCurrentPosition((p) => { pending.current = p; upload(true); }, onErr, { ...opts, maximumAge: 0 }); }}>Update my location</button>}
      {sharing && <button className="secondary-button h-12 w-full" disabled={busy} onClick={() => stop(false)}>Stop sharing location</button>}
      {consented && <button className="w-full text-center text-xs text-muted-foreground underline" disabled={busy} onClick={() => stop(true)}>Withdraw my consent</button>}
      <p className="text-xs text-muted-foreground">{NATIVE ? "Sharing continues with your phone locked. A notification shows while it is on." : "For browser tracking, keep this screen open. Updates may stop when your phone locks or you switch apps. Install the guard phone app to keep sharing with your phone in your pocket."}</p>
    </section>
  );
}
