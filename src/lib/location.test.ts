import { describe, expect, it } from "vitest";
import { isLowAccuracy, locationFreshness, pastCutoff, shouldUpload } from "./location";

const now = new Date("2026-10-25T05:00:00Z");
const ago = (s: number) => new Date(now.getTime() - s * 1000).toISOString();

describe("location freshness", () => {
  it("is fresh within 90 seconds of capture", () => expect(locationFreshness(ago(90), now)).toBe("fresh"));
  it("is delayed between 90 seconds and 5 minutes", () => expect(locationFreshness(ago(91), now)).toBe("delayed"));
  it("is stale after 5 minutes", () => expect(locationFreshness(ago(301), now)).toBe("stale"));
  it("is 'none' with no reading", () => expect(locationFreshness(null, now)).toBe("none"));
});

describe("accuracy", () => {
  it("flags readings worse than 100 m as low accuracy", () => {
    expect(isLowAccuracy(101)).toBe(true);
    expect(isLowAccuracy(100)).toBe(false);
  });
});

describe("phone cutoff", () => {
  it("stops at the approved shift end", () => {
    expect(pastCutoff(now.toISOString(), now)).toBe(true);
    expect(pastCutoff(new Date(now.getTime() + 1000).toISOString(), now)).toBe(false);
  });
});

describe("upload throttle", () => {
  const t = now.getTime();
  it("never sends an older reading than the last one sent", () =>
    expect(shouldUpload({ lastSentCapturedAt: t, lastSentAt: t - 60_000, capturedAt: t - 1, now: t, intervalS: 30, force: true })).toBe(false));
  it("waits 30 seconds between uploads", () => {
    expect(shouldUpload({ lastSentCapturedAt: t - 20_000, lastSentAt: t - 20_000, capturedAt: t, now: t, intervalS: 30 })).toBe(false);
    expect(shouldUpload({ lastSentCapturedAt: t - 30_000, lastSentAt: t - 30_000, capturedAt: t, now: t, intervalS: 30 })).toBe(true);
  });
});
