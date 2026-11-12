// Sends queued variation alert emails (one per recipient row). Called by the database when alerts are
// queued, and by a retry job only while some remain undelivered. Takes no input: it only ever sends
// rows the database queued, each to its own recipient, at most once (claim + idempotency key).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { EmailAPIError, sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async () => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: rows, error } = await admin.rpc('claim_staff_email_alerts', { _limit: 50 })
  if (error) return json({ error: error.message }, 500)

  const counts = { sent: 0, suppressed: 0, retry: 0, failed: 0 }
  let stop = false
  for (const row of rows ?? []) {
    if (stop) {
      await admin.from('staff_email_alerts').update({ status: 'pending', attempts: Math.max(0, row.attempts - 1) }).eq('id', row.id)
      continue
    }
    try {
      const result = await sendTemplateEmail('variation-alert', row.email, {
        idempotencyKey: `variation-alert-${row.id}`,
        templateData: {
          kind: row.kind, recipientName: row.full_name, ref: row.ref, shiftCount: row.shift_count,
          typeLabel: row.type_label, contractorName: row.contractor_name, byName: row.by_name, link: row.link,
        },
      })
      if (result.sent) {
        counts.sent++
        await admin.from('staff_email_alerts').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', row.id)
      } else {
        counts.suppressed++
        await admin.from('staff_email_alerts').update({ status: 'suppressed', last_error: result.reason }).eq('id', row.id)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Domain still verifying, emails switched off or rate-limited: put it back and try again later.
      const waitable = e instanceof EmailAPIError && (e.code === 'domain_not_verified' || e.code === 'emails_disabled' || e.status === 429)
      if (waitable) stop = true
      const giveUp = !waitable && row.attempts >= 5
      if (giveUp) counts.failed++; else counts.retry++
      await admin.from('staff_email_alerts').update({
        status: giveUp ? 'failed' : 'pending',
        attempts: waitable ? Math.max(0, row.attempts - 1) : row.attempts,
        last_error: msg.slice(0, 500),
      }).eq('id', row.id)
    }
  }

  await admin.rpc('sync_staff_email_retry')
  return json(counts)
})
