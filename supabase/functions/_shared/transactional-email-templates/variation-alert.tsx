/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  kind?: 'ack' | 'approve'
  recipientName?: string
  ref?: string
  shiftCount?: number
  typeLabel?: string
  contractorName?: string
  byName?: string
  link?: string
}

const VariationAlertEmail = ({
  kind = 'ack', recipientName, ref = 'Variation', shiftCount = 1, typeLabel = 'change',
  contractorName, byName, link = 'https://security.outthereadmin.com.au/admin/variations',
}: Props) => {
  const ack = kind === 'ack'
  const firstName = recipientName?.trim().split(/\s+/)[0]
  const shifts = `${shiftCount} ${shiftCount === 1 ? 'shift' : 'shifts'}`
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{ack ? `${ref} needs your acknowledgement` : `${ref} is ready for your approval`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>{ack ? 'Acknowledgement needed' : 'Approval needed'}</Text>
          <Heading style={h1}>Variation {ref}</Heading>
          <Text style={text}>
            {firstName ? `Hi ${firstName}, ` : ''}
            {ack
              ? 'a variation request needs your acknowledgement as the security provider.'
              : 'a variation request is ready for your final approval.'}
          </Text>
          <Section style={card}>
            <Text style={row}><strong>Change:</strong> {typeLabel}, {shifts}</Text>
            {contractorName ? <Text style={row}><strong>Provider:</strong> {contractorName}</Text> : null}
            {byName ? <Text style={row}>{byName}</Text> : null}
          </Section>
          <Button style={button} href={link}>{ack ? 'Review and acknowledge' : 'Review and approve'}</Button>
          <Text style={footer}>You're receiving this because you {ack ? 'acknowledge variations for your security provider' : 'approve variations'} in OTG Security Management.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: VariationAlertEmail,
  subject: (d: Record<string, any>) =>
    d.kind === 'approve'
      ? `Variation ${d.ref ?? ''} is ready for your approval`.replace('  ', ' ')
      : `Variation ${d.ref ?? ''} needs your acknowledgement`.replace('  ', ' '),
  displayName: 'Variation alert (acknowledge / approve)',
  previewData: {
    kind: 'ack', recipientName: 'Sam Taylor', ref: 'VAR-0042', shiftCount: 3, typeLabel: 'time change',
    contractorName: 'Sentinel Security', byName: 'Requested by Jordan Lee',
    link: 'https://security.outthereadmin.com.au/admin/variations',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }
const container = { padding: '24px 25px', borderTop: '4px solid #FFD129' }
const eyebrow = { fontSize: '12px', fontWeight: 'bold' as const, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#8A6A00', margin: '0 0 8px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0C111D', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#4A5568', lineHeight: '1.5', margin: '0 0 20px' }
const card = { backgroundColor: '#F5F6F8', borderRadius: '8px', padding: '12px 16px', margin: '0 0 24px' }
const row = { fontSize: '14px', color: '#0C111D', lineHeight: '1.5', margin: '4px 0' }
const button = { backgroundColor: '#FFD129', color: '#0C111D', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
