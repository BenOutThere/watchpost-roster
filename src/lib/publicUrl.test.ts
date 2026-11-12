import { describe, expect, it } from "vitest";
import { shareableOrigin } from "./publicUrl";

describe("shareableOrigin", () => {
  it("sends links made in the editor preview to the live app", () => {
    expect(shareableOrigin("https://id-preview--25f2a753-d099-4257-a083-69068bdc2f0b.lovable.app")).toBe("https://security.outthereadmin.com.au");
  });
  it("sends links made on the lovable.app address to the live app", () => {
    expect(shareableOrigin("https://watchpost-roster-command.lovable.app")).toBe("https://security.outthereadmin.com.au");
  });
  it("keeps the live domain when already on it", () => {
    expect(shareableOrigin("https://security.outthereadmin.com.au")).toBe("https://security.outthereadmin.com.au");
  });
  it("falls back to the live app for local or bad addresses", () => {
    expect(shareableOrigin("http://localhost:8080")).toBe("https://security.outthereadmin.com.au");
    expect(shareableOrigin("not a url")).toBe("https://security.outthereadmin.com.au");
  });
});
