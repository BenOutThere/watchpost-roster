import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Link } from "react-router-dom";
import { MapPin, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { effectiveDeployment, fmtTime } from "@/lib/roster";
import { DEFAULT_LOCATION_SETTINGS, FRESHNESS_LABEL, fmtAge, isLowAccuracy, locationFreshness, type Freshness, type LocationSettings } from "@/lib/location";
import { useOps } from "./OpsContext";
import { Page, Panel } from "./ui";

type Loc = { session_id: string; guard_id: string; contractor_id: string | null; latitude: number; longitude: number; accuracy: number | null; captured_at: string; received_at: string };
// Free OpenStreetMap-based vector tiles (OpenFreeMap), attribution shown on the map. Swap for a licensed provider before heavy production use.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const FALLBACK_CENTER: [number, number] = [151.2093, -33.8688];
const cssColor = (v: string, a = 1) => `hsla(${getComputedStyle(document.documentElement).getPropertyValue(v).trim().replace(/ /g, ", ")}, ${a})`;
const ICON: Record<Freshness, string> = { fresh: "●", delayed: "◐", stale: "○", none: "–" };

function circlePolygon(lng: number, lat: number, m: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * 2 * Math.PI;
    pts.push([lng + (m / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (m / 110540) * Math.sin(a)]);
  }
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [pts] } };
}

export function LiveMapPage({ embedded = false }: { embedded?: boolean } = {}) {
  const Wrap = embedded ? ((({ children }: { children: React.ReactNode }) => <section id="live-map" aria-label="Live Map" className="space-y-4"><h2 className="text-lg font-bold">Live Map</h2>{children}</section>) as typeof Page) : Page;
  const { event, slots, attendance, guards, contractors, contractorName, isManager, myContractorIds } = useOps();
  const tz = event?.timezone ?? "Australia/Sydney";
  const [locs, setLocs] = useState<Map<string, Loc>>(new Map());
  const [settings, setSettings] = useState<LocationSettings>(DEFAULT_LOCATION_SETTINGS);
  const [conn, setConn] = useState<"connecting" | "live" | "down">("connecting");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [q, setQ] = useState(""); const [cf, setCf] = useState(""); const [zf, setZf] = useState(""); const [rf, setRf] = useState(""); const [ff, setFf] = useState<Freshness | "">("");
  const [hideStale, setHideStale] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const fitted = useRef(false);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 10_000); return () => clearInterval(t); }, []);

  // Authorised snapshot + realtime changes for this event only. RLS limits rows to the viewer's scope.
  useEffect(() => {
    if (!event) return;
    let alive = true; let timer: ReturnType<typeof setTimeout> | null = null;
    setLocs(new Map()); fitted.current = false; setSelected(null); setConn("connecting");
    const fetchSnap = async () => {
      const { data, error } = await supabase.from("guard_latest_locations").select("session_id,guard_id,contractor_id,latitude,longitude,accuracy,captured_at,received_at").eq("event_id", event.id);
      if (!alive) return;
      if (error) { setConn("down"); return; }
      setLocs(new Map((data ?? []).map((l) => [l.guard_id, l as Loc]))); setLastSync(new Date());
    };
    const soon = () => { if (timer) clearTimeout(timer); timer = setTimeout(fetchSnap, 400); };
    supabase.from("event_location_settings").select("*").eq("event_id", event.id).maybeSingle().then(({ data }) => alive && setSettings({ ...DEFAULT_LOCATION_SETTINGS, ...(data ?? {}) } as LocationSettings));
    const ch = supabase.channel(`live-map-${event.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "guard_latest_locations", filter: `event_id=eq.${event.id}` }, soon)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "guard_tracking_sessions", filter: `event_id=eq.${event.id}` }, soon)
      .subscribe((st) => {
        if (!alive) return;
        if (st === "SUBSCRIBED") { setConn("live"); fetchSnap(); } // refetch after every (re)connect
        else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") setConn("down");
      });
    const poll = setInterval(fetchSnap, 60_000); // safety net; also drops readings whose shift cutoff passed
    return () => { alive = false; if (timer) clearTimeout(timer); clearInterval(poll); supabase.removeChannel(ch); };
  }, [event?.id]);

  // Everyone signed on to a position at this event, with or without a location.
  const slotById = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
  const guardById = useMemo(() => new Map(guards.map((g) => [g.id, g])), [guards]);
  const rows = useMemo(() => attendance
    .filter((a) => !a.signed_off_at && a.slot_id && slotById.has(a.slot_id))
    .map((a) => {
      const s = slotById.get(a.slot_id!)!; const g = guardById.get(a.guard_id); const d = effectiveDeployment(s, now);
      const loc = locs.get(a.guard_id) ?? null;
      const cid = s.contractor_id ?? g?.contractor_id ?? null;
      return { id: a.guard_id, name: g?.name ?? "Guard", contractorId: cid, contractor: contractorName(cid), position: d.position, zone: d.zone, role: d.role, end: s.current_end, loc, fresh: locationFreshness(loc?.captured_at, now, settings) };
    })
    .filter((r) => isManager || (r.contractorId && myContractorIds.includes(r.contractorId)))
    .sort((a, b) => a.name.localeCompare(b.name)), [attendance, slotById, guardById, locs, now, settings, contractorName, isManager, myContractorIds]);

  const zones = useMemo(() => [...new Set(rows.map((r) => r.zone).filter(Boolean))].sort(), [rows]);
  const roles = useMemo(() => [...new Set(rows.map((r) => r.role).filter(Boolean))].sort(), [rows]);
  const shown = rows.filter((r) => (!cf || r.contractorId === cf) && (!zf || r.zone === zf) && (!rf || r.role === rf) && (!ff || r.fresh === ff)
    && (!q || `${r.name} ${r.position} ${r.zone} ${r.contractor}`.toLowerCase().includes(q.toLowerCase())));
  const onMap = shown.filter((r) => r.loc && !(hideStale && r.fresh === "stale"));
  const noLoc = shown.filter((r) => !r.loc);
  const counts = rows.reduce((m, r) => ({ ...m, [r.fresh]: (m[r.fresh] ?? 0) + 1 }), {} as Record<Freshness, number>);

  // Map setup once.
  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const m = new maplibregl.Map({ container: mapEl.current, style: STYLE_URL, center: FALLBACK_CENTER, zoom: 14, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => {
      m.addSource("guards", { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterRadius: 40, clusterMaxZoom: 18 });
      m.addSource("accuracy", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "accuracy", type: "fill", source: "accuracy", paint: { "fill-color": cssColor("--primary", 0.15), "fill-outline-color": cssColor("--primary") } });
      m.addLayer({ id: "clusters", type: "circle", source: "guards", filter: ["has", "point_count"], paint: { "circle-color": cssColor("--navy", 0.9), "circle-stroke-color": cssColor("--primary"), "circle-stroke-width": 2, "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26] } });
      m.addLayer({ id: "cluster-count", type: "symbol", source: "guards", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Bold"] }, paint: { "text-color": cssColor("--foreground") } });
      m.addLayer({ id: "guard", type: "circle", source: "guards", filter: ["!", ["has", "point_count"]], paint: {
        "circle-radius": ["case", ["get", "sel"], 11, 8],
        "circle-color": ["match", ["get", "fresh"], "fresh", cssColor("--success"), "delayed", cssColor("--warning"), cssColor("--muted-foreground")],
        "circle-opacity": ["match", ["get", "fresh"], "stale", 0.45, 1],
        "circle-stroke-width": ["case", ["get", "low"], 3, 2],
        "circle-stroke-color": ["case", ["get", "low"], cssColor("--danger"), cssColor("--background")],
      } });
      m.addLayer({ id: "guard-label", type: "symbol", source: "guards", filter: ["!", ["has", "point_count"]], minzoom: 16, layout: { "text-field": ["get", "label"], "text-size": 11, "text-offset": [0, 1.4], "text-anchor": "top", "text-font": ["Noto Sans Regular"] }, paint: { "text-color": cssColor("--background"), "text-halo-color": "hsla(0,0%,100%,0.9)", "text-halo-width": 1.5 } });
      m.on("click", "guard", (e) => { const id = e.features?.[0]?.properties?.id; if (id) setSelected(id); });
      m.on("click", "clusters", async (e) => {
        const f = e.features?.[0]; if (!f) return;
        const z = await (m.getSource("guards") as GeoJSONSource).getClusterExpansionZoom(f.properties!.cluster_id);
        m.easeTo({ center: (f.geometry as any).coordinates, zoom: z });
      });
      for (const l of ["guard", "clusters"]) { m.on("mouseenter", l, () => (m.getCanvas().style.cursor = "pointer")); m.on("mouseleave", l, () => (m.getCanvas().style.cursor = "")); }
      setMapReady(true);
    });
    map.current = m;
    return () => { m.remove(); map.current = null; setMapReady(false); };
  }, []);

  // Push data to the map without moving it (only fit once per event).
  useEffect(() => {
    const m = map.current; if (!m || !mapReady) return;
    const features = onMap.map((r) => ({ type: "Feature" as const, properties: { id: r.id, fresh: r.fresh, low: isLowAccuracy(r.loc!.accuracy, settings), sel: r.id === selected, label: `${r.name} · ${FRESHNESS_LABEL[r.fresh]}` }, geometry: { type: "Point" as const, coordinates: [r.loc!.longitude, r.loc!.latitude] } }));
    (m.getSource("guards") as GeoJSONSource)?.setData({ type: "FeatureCollection", features });
    const sel = onMap.find((r) => r.id === selected);
    (m.getSource("accuracy") as GeoJSONSource)?.setData({ type: "FeatureCollection", features: sel?.loc?.accuracy ? [circlePolygon(sel.loc.longitude, sel.loc.latitude, sel.loc.accuracy)] : [] });
    if (!fitted.current && features.length) {
      const b = new maplibregl.LngLatBounds();
      features.forEach((f) => b.extend(f.geometry.coordinates as [number, number]));
      m.fitBounds(b, { padding: 60, maxZoom: 17, duration: 0 });
      fitted.current = true;
    }
  }, [onMap, selected, mapReady, settings]);

  const sel = rows.find((r) => r.id === selected) ?? null;
  const focus = (r: (typeof rows)[number]) => { setSelected(r.id); if (r.loc) map.current?.easeTo({ center: [r.loc.longitude, r.loc.latitude], zoom: Math.max(map.current.getZoom(), 17) }); };

  if (!event) return embedded ? null : <Page><Panel title="No event selected">Choose an event first.</Panel></Page>;

  return (
    <Wrap>
      {conn === "down" && <div role="alert" className="rounded-md border border-danger bg-danger/15 p-3 text-sm font-semibold">Live updates are unavailable — locations shown may be out of date. Reconnecting…</div>}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5">{conn === "live" ? <Wifi className="h-4 w-4 text-success" aria-hidden /> : <WifiOff className="h-4 w-4 text-danger" aria-hidden />}{conn === "live" ? "Live" : conn === "connecting" ? "Connecting…" : "Disconnected"}</span>
        {lastSync && <span className="text-muted-foreground">Last sync {fmtTime(lastSync.toISOString(), tz)}</span>}
        <span className="text-muted-foreground">·</span>
        {(["fresh", "delayed", "stale", "none"] as Freshness[]).map((f) => <span key={f} className="text-muted-foreground"><span aria-hidden>{ICON[f]}</span> {FRESHNESS_LABEL[f]}: <b className="text-foreground">{counts[f] ?? 0}</b></span>)}
      </div>

      <div className="flex flex-wrap gap-2">
        <input className="control-input h-10 w-56" placeholder="Search guard, position, zone…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search guards" />
        <select className="control-input h-10 w-auto" value={cf} onChange={(e) => setCf(e.target.value)} aria-label="Contractor"><option value="">All contractors</option>{contractors.filter((c) => isManager || myContractorIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="control-input h-10 w-auto" value={zf} onChange={(e) => setZf(e.target.value)} aria-label="Assigned zone"><option value="">All zones</option>{zones.map((z) => <option key={z}>{z}</option>)}</select>
        <select className="control-input h-10 w-auto" value={rf} onChange={(e) => setRf(e.target.value)} aria-label="Role"><option value="">All roles</option>{roles.map((r) => <option key={r}>{r}</option>)}</select>
        <select className="control-input h-10 w-auto" value={ff} onChange={(e) => setFf(e.target.value as Freshness | "")} aria-label="Location freshness"><option value="">Any freshness</option>{(["fresh", "delayed", "stale", "none"] as Freshness[]).map((f) => <option key={f} value={f}>{FRESHNESS_LABEL[f]}</option>)}</select>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={hideStale} onChange={(e) => setHideStale(e.target.checked)} /> Hide stale</label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="panel relative min-h-[520px] overflow-hidden p-0">
          <div ref={mapEl} className="absolute inset-0" aria-label="Map of guard phone locations" role="region" />
          {sel && (
            <div className="absolute bottom-3 left-3 z-10 max-w-xs rounded-md border border-border bg-card p-3 text-sm shadow-control">
              <div className="flex items-start justify-between gap-2"><p className="font-bold">{sel.name}</p><button className="text-xs text-muted-foreground" onClick={() => setSelected(null)} aria-label="Close">✕</button></div>
              <p className="text-muted-foreground">{sel.contractor}</p>
              <p className="mt-1"><span className="text-muted-foreground">Assigned post:</span> {sel.position} · {sel.zone}</p>
              <p><span className="text-muted-foreground">Shift ends:</span> {fmtTime(sel.end, tz)}</p>
              {sel.loc ? <>
                <p><span className="text-muted-foreground">Phone location:</span> {FRESHNESS_LABEL[sel.fresh]} — captured {fmtTime(sel.loc.captured_at, tz)} ({fmtAge(sel.loc.captured_at, now)})</p>
                <p><span className="text-muted-foreground">Accuracy:</span> ±{Math.round(sel.loc.accuracy ?? 0)} m{isLowAccuracy(sel.loc.accuracy, settings) && <b className="text-danger"> · Low accuracy</b>}</p>
              </> : <p className="text-muted-foreground">Signed on — location unavailable</p>}
            </div>
          )}
          <p className="absolute right-3 bottom-8 z-10 rounded bg-card/90 px-2 py-1 text-[11px] text-muted-foreground">Dots show measured phone locations, not assigned posts. Posts have no map coordinates yet.</p>
        </div>

        <Panel title={`Signed on (${shown.length})`} description="Everyone signed on, including guards not sharing a location." className="min-w-0">
          <ul className="max-h-[560px] space-y-1 overflow-y-auto text-sm">
            {[...onMap, ...shown.filter((r) => r.loc && hideStale && r.fresh === "stale"), ...noLoc].map((r) => (
              <li key={r.id}>
                <button onClick={() => focus(r)} className={`w-full rounded-md border px-3 py-2 text-left ${selected === r.id ? "border-primary" : "border-border"} ${r.fresh === "stale" ? "opacity-70" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{r.name}</span>
                    <span className={`shrink-0 text-xs ${r.fresh === "fresh" ? "text-success" : r.fresh === "delayed" ? "text-warning" : "text-muted-foreground"}`}><span aria-hidden>{ICON[r.fresh]} </span>{r.loc ? `${FRESHNESS_LABEL[r.fresh]} · ${fmtAge(r.loc.captured_at, now)}` : "Location unavailable"}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{r.position} · {r.zone} · {r.contractor}</p>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="text-muted-foreground">No signed-on guards match.</li>}
          </ul>
          <Link to="/admin/sign-in" className="mt-3 inline-flex items-center gap-1 text-xs text-primary"><MapPin className="h-3 w-3" /> Sign-in desk</Link>
        </Panel>
      </div>
    </Wrap>
  );
}
