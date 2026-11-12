import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

/** Prefix used in every guard pass QR so random codes are ignored. */
export const GUARD_QR_PREFIX = "GUARDPASS:";
export const guardQrValue = (guardId: string) => `${GUARD_QR_PREFIX}${guardId}`;
/** Passes are encoded uppercase for faster scanning; guard ids are lowercase UUIDs. */
export const parseGuardQr = (text: string) => {
  const t = text.trim();
  return t.toUpperCase().startsWith(GUARD_QR_PREFIX) ? t.slice(GUARD_QR_PREFIX.length).toLowerCase() : null;
};

/**
 * Listens for USB/Bluetooth "keyboard wedge" scanners (e.g. Netum): they type the QR text very fast
 * then press Enter. Fires onScan with any burst containing the guard pass prefix, wherever focus is.
 */
export function useHardwareScanner(onScan: (text: string) => void, enabled = true) {
  const cb = useRef(onScan);
  cb.current = onScan;
  useEffect(() => {
    if (!enabled) return;
    let buf = "";
    let last = 0;
    const handler = (e: KeyboardEvent) => {
      const t = performance.now();
      if (t - last > 100) buf = ""; // humans type slower than scanners
      last = t;
      if (e.key === "Enter" || e.key === "Tab") {
        const i = buf.toUpperCase().indexOf(GUARD_QR_PREFIX);
        if (i >= 0) {
          e.preventDefault();
          const text = GUARD_QR_PREFIX + buf.slice(i + GUARD_QR_PREFIX.length).trim().toLowerCase();
          buf = "";
          cb.current(text);
        }
        buf = "";
        return;
      }
      if (e.key.length === 1) {
        buf += e.key;
        // Keep scanner text out of whatever input has focus once it's clearly a guard pass.
        if (buf.toUpperCase().includes("GUARDP")) e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [enabled]);
}

/** Camera scanner overlay. Calls onScan once with the decoded text. */
export function QrScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const id = useRef(`qr-${Math.random().toString(36).slice(2)}`).current;
  const [error, setError] = useState("");
  useEffect(() => {
    const scanner = new Html5Qrcode(id);
    let done = false;
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 240 }, (text) => {
      if (done) return; done = true;
      scanner.stop().catch(() => {}).finally(() => onScan(text));
    }, () => {}).catch(() => setError("Camera unavailable. Allow camera access or search by name instead."));
    return () => { if (!done) scanner.stop().catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4">
      <div className="panel w-full max-w-md space-y-3 p-4">
        <p className="font-semibold">Scan guard pass</p>
        <div id={id} className="overflow-hidden rounded-md" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button className="secondary-button h-11 w-full" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
