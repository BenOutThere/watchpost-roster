// Guard location rules shared by the Live Map and the guard phone. Pure functions, tested in location.test.ts.
// Location is separate from attendance: it never changes sign-on, missing counts, variations or pay.

export type LocationSettings = { enabled: boolean; upload_interval_s: number; fresh_s: number; stale_s: number; low_accuracy_m: number; notice_version: string };
export const DEFAULT_LOCATION_SETTINGS: LocationSettings = { enabled: true, upload_interval_s: 30, fresh_s: 90, stale_s: 300, low_accuracy_m: 100, notice_version: "v1" };

export type Freshness = "fresh" | "delayed" | "stale" | "none";
export const FRESHNESS_LABEL: Record<Freshness, string> = { fresh: "Fresh", delayed: "Delayed", stale: "Stale", none: "No location" };

/** Age comes from when the phone captured the reading, never when the server received it. */
export function locationFreshness(capturedAt: string | null | undefined, now: Date, s: Pick<LocationSettings, "fresh_s" | "stale_s"> = DEFAULT_LOCATION_SETTINGS): Freshness {
  if (!capturedAt) return "none";
  const age = (now.getTime() - new Date(capturedAt).getTime()) / 1000;
  if (age <= s.fresh_s) return "fresh";
  if (age <= s.stale_s) return "delayed";
  return "stale";
}

export const isLowAccuracy = (accuracy: number | null | undefined, s: Pick<LocationSettings, "low_accuracy_m"> = DEFAULT_LOCATION_SETTINGS) =>
  accuracy == null || accuracy > s.low_accuracy_m;

export function fmtAge(capturedAt: string, now: Date) {
  const sec = Math.max(0, Math.round((now.getTime() - new Date(capturedAt).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m ago`;
}

/** Phone-side cutoff: stop collecting once the approved shift end passes, even if the server can't be reached. */
export const pastCutoff = (expiresAt: string | null | undefined, now: Date) => !expiresAt || now.getTime() >= new Date(expiresAt).getTime();

/** Upload a new reading only when it is newer than the last one sent and the throttle interval has passed. */
export function shouldUpload(opts: { lastSentCapturedAt: number | null; lastSentAt: number | null; capturedAt: number; now: number; intervalS: number; force?: boolean }) {
  const { lastSentCapturedAt, lastSentAt, capturedAt, now, intervalS, force } = opts;
  if (lastSentCapturedAt != null && capturedAt <= lastSentCapturedAt) return false;
  if (force || lastSentAt == null) return true;
  return now - lastSentAt >= intervalS * 1000;
}
