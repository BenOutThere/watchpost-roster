/** The live app address everyone outside the editor can open. */
export const PUBLIC_APP_URL = "https://security.outthereadmin.com.au";

/**
 * Origin to put in links sent to other people (invites, guard sign-up QR codes).
 * Editor previews and other hosts are private to the builder, so links made there
 * point at the live app instead.
 */
export function shareableOrigin(origin: string = typeof window !== "undefined" ? window.location.origin : ""): string {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === "security.outthereadmin.com.au") return new URL(origin).origin;
  } catch {
    /* fall through */
  }
  return PUBLIC_APP_URL;
}
