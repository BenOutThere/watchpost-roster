// Sends one email through Resend (https://resend.com). Shared by the auth email hook
// and the staff alert sender.
//
// Edge function secrets:
//   RESEND_API_KEY  required
//   EMAIL_FROM      optional, defaults to "OTG Security Management <noreply@security.outthereadmin.com.au>"
//                   (the domain must be verified in Resend)

export const SITE_NAME = 'OTG Security Management'
const DEFAULT_FROM = `${SITE_NAME} <noreply@security.outthereadmin.com.au>`

export class EmailAPIError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message)
    this.name = 'EmailAPIError'
  }
}

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  idempotencyKey?: string
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new EmailAPIError('RESEND_API_KEY is not configured', 503, 'emails_disabled')

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  if (msg.idempotencyKey) headers['Idempotency-Key'] = msg.idempotencyKey.slice(0, 256)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_FROM') || DEFAULT_FROM,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      reply_to: msg.replyTo,
    }),
  })
  if (res.ok) return

  let body: { name?: string; message?: string } = {}
  try { body = await res.json() } catch { /* not JSON */ }
  // Resend reports an unverified sender domain as 403 validation_error.
  const code = res.status === 403 && /domain/i.test(body.message ?? '')
    ? 'domain_not_verified'
    : body.name ?? `http_${res.status}`
  throw new EmailAPIError(body.message ?? `Resend returned ${res.status}`, res.status, code)
}
