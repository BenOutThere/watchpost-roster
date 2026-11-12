import { useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Field, Panel } from "./ui";
import { useOps } from "./OpsContext";
import { shareableOrigin } from "@/lib/publicUrl";

/** Poster colours are user-chosen branding, so they are applied as inline styles rather than theme tokens. */
const PRESETS = [
  { name: "Safety yellow", value: "#EAB308" },
  { name: "High-vis orange", value: "#F97316" },
  { name: "Security blue", value: "#2563EB" },
  { name: "Green", value: "#10B981" },
  { name: "Red", value: "#DC2626" },
];

export function GuardPoster() {
  const { contractors, isManager, myContractorIds } = useOps();
  const providers = isManager ? contractors : contractors.filter((c) => myContractorIds.includes(c.id));
  const [provider, setProvider] = useState(() => (!isManager && myContractorIds.length === 1 ? myContractorIds[0] : ""));
  const link = `${shareableOrigin()}/mobile/onboarding${provider ? `?provider=${provider}` : ""}`;
  const [accent, setAccent] = useState(PRESETS[0].value);
  const [dark, setDark] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [headline, setHeadline] = useState("SECURITY STAFF REGISTRATION");
  const [subtitle, setSubtitle] = useState("Scan to register before your first shift");
  const [eventName, setEventName] = useState("");
  const [footer, setFooter] = useState("Questions? See your supervisor at the sign-in desk.");
  const canvasRef = useRef<HTMLDivElement>(null);

  const bg = dark ? "#0F172A" : "#FFFFFF";
  const fg = dark ? "#F8FAFC" : "#0F172A";
  const muted = dark ? "#CBD5E1" : "#475569";

  const onLogo = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setLogo(String(r.result));
    r.readAsDataURL(f);
  };

  const downloadQr = () => {
    const c = canvasRef.current?.querySelector("canvas");
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "guard-registration-qr.png";
    a.click();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <div className="no-print">
        <Panel title="Poster settings" description="Add your branding and colours, then print or save as PDF.">
          <div className="space-y-3">
            <Field label="Security provider">
              <select className="control-input h-11 w-full" value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="">Any — guards choose their provider</option>
                {providers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <p className="-mt-1 text-xs text-muted-foreground">Picking a provider pre-fills it for guards who scan this poster.</p>
            <Field label="Logo"><input type="file" accept="image/*" className="control-input h-11 w-full" onChange={(e) => onLogo(e.target.files?.[0])} /></Field>
            {logo && <button className="text-xs text-muted-foreground underline" onClick={() => setLogo(null)}>Remove logo</button>}
            <Field label="Headline"><input className="control-input h-11 w-full" value={headline} onChange={(e) => setHeadline(e.target.value)} /></Field>
            <Field label="Subtitle"><input className="control-input h-11 w-full" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></Field>
            <Field label="Event / venue name"><input className="control-input h-11 w-full" placeholder="Optional" value={eventName} onChange={(e) => setEventName(e.target.value)} /></Field>
            <Field label="Footer note"><input className="control-input h-11 w-full" value={footer} onChange={(e) => setFooter(e.target.value)} /></Field>
            <Field label="Brand colour">
              <div className="flex flex-wrap items-center gap-2">
                {PRESETS.map((p) => (
                  <button key={p.value} title={p.name} aria-label={p.name} onClick={() => setAccent(p.value)}
                    className={`h-8 w-8 rounded-full border-2 ${accent === p.value ? "border-foreground" : "border-transparent"}`} style={{ background: p.value }} />
                ))}
                <input type="color" aria-label="Custom colour" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent" />
              </div>
            </Field>
            <Field label="Background">
              <div className="flex gap-2">
                <button className={dark ? "secondary-button h-10 flex-1" : "primary-button h-10 flex-1"} onClick={() => setDark(false)}>Light (print)</button>
                <button className={dark ? "primary-button h-10 flex-1" : "secondary-button h-10 flex-1"} onClick={() => setDark(true)}>Dark (screens)</button>
              </div>
            </Field>
            <div className="grid gap-2 pt-2">
              <button className="primary-button h-11" onClick={() => window.print()}>Print / save as PDF</button>
              <button className="secondary-button h-11" onClick={downloadQr}>Download QR code (PNG)</button>
              <button className="secondary-button h-11" onClick={() => navigator.clipboard.writeText(link)}>Copy registration link</button>
            </div>
            <code className="block break-all rounded-md bg-secondary p-2 text-xs">{link}</code>
          </div>
        </Panel>
        <div ref={canvasRef} className="hidden"><QRCodeCanvas value={link} size={1024} level="H" marginSize={2} /></div>
      </div>

      <div className="flex justify-center">
        <div id="guard-poster" className="flex aspect-[210/297] w-full max-w-[560px] flex-col items-center overflow-hidden rounded-md shadow-lg" style={{ background: bg, color: fg }}>
          <div className="h-4 w-full" style={{ background: accent }} />
          <div className="flex w-full flex-1 flex-col items-center justify-between px-[8%] py-[6%] text-center">
            <div className="flex flex-col items-center gap-3">
              {logo && <img src={logo} alt="Logo" className="max-h-20 max-w-[60%] object-contain" />}
              {eventName && <p className="text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: muted }}>{eventName}</p>}
              <h1 className="text-3xl font-black leading-tight">{headline}</h1>
              <p className="text-base" style={{ color: muted }}>{subtitle}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "#FFFFFF", border: `6px solid ${accent}` }}>
              <QRCodeSVG value={link} size={230} level="H" marginSize={1} />
            </div>
            <ol className="grid w-full gap-2 text-left text-sm">
              {["Scan the QR code with your phone camera", "Fill in your guard profile", "Show your guard pass at the sign-in desk"].map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ background: accent, color: "#0F172A" }}>{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            {footer && <p className="text-xs" style={{ color: muted }}>{footer}</p>}
          </div>
          <div className="h-4 w-full" style={{ background: accent }} />
        </div>
      </div>
    </div>
  );
}
