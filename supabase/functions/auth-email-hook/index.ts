// Supabase Auth "Send Email" hook: sends the branded login emails (sign-up confirmation,
// invites, password resets, magic links, email change, verification codes) through Resend.
//
// Turn it on in Supabase → Authentication → Hooks → "Send Email hook" → HTTPS, pointing at
// this function. Supabase shows a secret ("v1,whsec_..."): save it as the edge function
// secret SEND_EMAIL_HOOK_SECRET. Also needs RESEND_API_KEY (see ../_shared/email.ts).
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'
import { SITE_NAME, sendEmail } from '../_shared/email.ts'

const SITE_URL = 'https://security.outthereadmin.com.au'

interface HookPayload {
  user: { email: string; new_email?: string }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
    site_url: string
    token_new?: string
    token_hash_new?: string
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function verifyUrl(tokenHash: string, type: string, redirectTo: string): string {
  const base = Deno.env.get('SUPABASE_URL')!.replace(/\/$/, '')
  const params = new URLSearchParams({ token: tokenHash, type, redirect_to: redirectTo || SITE_URL })
  return `${base}/auth/v1/verify?${params}`
}

async function send(to: string, subject: string, element: React.ReactElement) {
  const html = await renderAsync(element)
  const text = await renderAsync(element, { plainText: true })
  await sendEmail({ to, subject, html, text })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const secret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  if (!secret) return json({ error: { http_code: 500, message: 'SEND_EMAIL_HOOK_SECRET is not configured' } }, 500)

  const raw = await req.text()
  let payload: HookPayload
  try {
    const wh = new Webhook(secret.replace(/^v1,whsec_/, ''))
    payload = wh.verify(raw, Object.fromEntries(req.headers)) as HookPayload
  } catch {
    return json({ error: { http_code: 401, message: 'Invalid signature' } }, 401)
  }

  const { user, email_data: d } = payload
  const type = d.email_action_type
  const url = verifyUrl(d.token_hash, type, d.redirect_to)

  try {
    switch (type) {
      case 'signup':
        await send(user.email, 'Confirm your email', React.createElement(SignupEmail, {
          siteName: SITE_NAME, siteUrl: SITE_URL, recipient: user.email, confirmationUrl: url,
        }))
        break
      case 'invite':
        await send(user.email, "You've been invited", React.createElement(InviteEmail, {
          siteName: SITE_NAME, siteUrl: SITE_URL, confirmationUrl: url,
        }))
        break
      case 'magiclink':
        await send(user.email, 'Your login link', React.createElement(MagicLinkEmail, {
          siteName: SITE_NAME, confirmationUrl: url,
        }))
        break
      case 'recovery':
        await send(user.email, 'Reset your password', React.createElement(RecoveryEmail, {
          siteName: SITE_NAME, confirmationUrl: url,
        }))
        break
      case 'email_change': {
        const newEmail = user.new_email ?? ''
        const props = { siteName: SITE_NAME, oldEmail: user.email, email: user.email, newEmail }
        // With "secure email change" on, Supabase sends two hashes: token_hash_new goes to the
        // current address and token_hash to the new one (Supabase's naming is reversed).
        if (d.token_hash_new) {
          await send(user.email, 'Confirm your new email', React.createElement(EmailChangeEmail, {
            ...props, confirmationUrl: verifyUrl(d.token_hash_new, type, d.redirect_to),
          }))
        }
        if (newEmail) {
          await send(newEmail, 'Confirm your new email', React.createElement(EmailChangeEmail, {
            ...props, confirmationUrl: url,
          }))
        }
        break
      }
      case 'reauthentication':
        await send(user.email, 'Your verification code', React.createElement(ReauthenticationEmail, { token: d.token }))
        break
      default:
        return json({ error: { http_code: 400, message: `Unsupported email type: ${type}` } }, 400)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return json({ error: { http_code: 500, message } }, 500)
  }

  return json({})
})
