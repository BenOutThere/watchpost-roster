import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

/** Public privacy policy (no login) — linked from guard signup, the location consent notice and the app store listings. */
export const PRIVACY_CONTACT_EMAIL = "privacy@outthereadmin.com.au";
const OPERATOR = "Out There Admin";
const APP = "OTG Event Security";
const UPDATED = "25 October 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <article className="panel mx-auto max-w-3xl space-y-6 p-6 sm:p-8">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-primary"><ShieldCheck className="h-6 w-6" aria-hidden /><span className="text-sm font-semibold uppercase tracking-wide">{APP}</span></div>
          <h1 className="text-3xl font-bold text-foreground">Privacy policy</h1>
          <p className="text-sm text-muted-foreground">Last updated {UPDATED}. This policy covers the {APP} phone app and the website at security.outthereadmin.com.au, operated by {OPERATOR} ("we", "us"). We handle personal information under the Australian Privacy Act 1988 and the Australian Privacy Principles.</p>
        </header>

        <Section title="Who uses the app">
          <p>The app is used to roster, sign on and manage security guards at events. It is used by event organisers, control room staff, security companies (providers) and the guards they employ. It is not intended for the general public or for anyone under 18.</p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Account details:</b> name, email address, mobile number and password (stored only in encrypted form).</li>
            <li><b>Guard profile:</b> the security company you work for, employee ID, security licence number, emergency contact and an optional profile photo.</li>
            <li><b>Shift records:</b> when you were signed on and off, the position and shift you were placed on, and who signed you on.</li>
            <li><b>Guard pass:</b> a QR code unique to you, so the sign-in desk can find your profile.</li>
            <li><b>Location (only if you agree):</b> your phone's current location while you are signed on to a shift. See "Location sharing" below.</li>
            <li><b>Messages:</b> text messages and emails sent to you about your shifts, and whether they were delivered.</li>
            <li><b>Technical information:</b> basic device and log information needed to keep the service secure and working.</li>
          </ul>
          <p>Staff at the sign-in desk may use their device's camera to scan guard QR codes. The camera is not used to take or store photos.</p>
        </Section>

        <Section title="Location sharing">
          <p>Location sharing is optional and only available to guards. It never affects your sign-on, your shift or your pay.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>When it is collected:</b> only after you read the in-app notice and tap "I agree — start sharing", and only while you are signed on to a shift. In the phone app this continues while your phone is locked or the app is closed or not in use, and your phone shows a notification the whole time.</li>
            <li><b>When it stops:</b> automatically when you are signed off, when your scheduled shift ends, when you log out, or whenever you tap Stop or withdraw consent.</li>
            <li><b>Why:</b> so event management and the control room can see where guards are during the event for safety and deployment.</li>
            <li><b>Who can see it:</b> event management, the event control room, and managers at your own security company. Other security companies cannot see you.</li>
            <li><b>What is kept:</b> only your latest location. It is deleted as soon as sharing stops. We do not keep a location history.</li>
            <li>We do not use location for advertising, and we never sell or share it with anyone else.</li>
          </ul>
        </Section>

        <Section title="How we use your information">
          <ul className="list-disc space-y-1 pl-5">
            <li>To roster events, sign guards on and off, and record who worked which shift.</li>
            <li>To send you shift updates and alerts by text message or email.</li>
            <li>To approve and record changes to shifts, and to reconcile hours after an event.</li>
            <li>To keep the service secure, prevent misuse and meet legal obligations.</li>
          </ul>
        </Section>

        <Section title="Who we share it with">
          <p>Your information is shared only with the people running the event you work at (event management and control room) and your own security company. We use trusted service providers to run the app, who handle information only on our instructions:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Cloud hosting and database services that store the app's data.</li>
            <li>Tall Bob, to send text messages.</li>
            <li>An email delivery service, to send account and shift emails.</li>
          </ul>
          <p>Some of these providers may store data outside Australia. We do not sell personal information and we do not use it for advertising.</p>
        </Section>

        <Section title="How long we keep it">
          <p>Location is deleted as soon as sharing stops. Account, profile and shift records are kept while you have an account and afterwards for as long as needed to reconcile events, pay contractors and meet legal and record-keeping obligations.</p>
        </Section>

        <Section title="Security">
          <p>Information is sent over encrypted connections and access is limited by role, so people only see what their job needs. Messaging account keys are stored encrypted.</p>
        </Section>

        <Section title="Your choices and rights">
          <ul className="list-disc space-y-1 pl-5">
            <li>You can stop location sharing or withdraw consent at any time in the app, or turn off location permission in your phone's settings.</li>
            <li>You can view and update your contact details in the app.</li>
            <li><b>Deleting your account:</b> guards can delete their account at any time in the app under Profile → Delete my account (not while signed on to a shift). This deletes your login, contact and licence details, photo and any location data straight away. Your name and employee ID stay on past shift records, which are needed for hours, pay and legal records. You can also ask us to delete your account by email.</li>
            <li>You can ask to access or correct your information, or ask us to delete your account, by emailing <a className="text-primary underline" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>. Some shift records may need to be kept for legal reasons.</li>
            <li>If you have a privacy complaint, contact us first. If you are not satisfied, you can contact the Office of the Australian Information Commissioner (oaic.gov.au).</li>
          </ul>
        </Section>

        <Section title="Changes and contact">
          <p>We may update this policy and will change the date above when we do. If the location notice changes, the app asks for your agreement again before sharing.</p>
          <p>Questions: <a className="text-primary underline" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a></p>
        </Section>

        <footer className="border-t border-border pt-4 text-sm"><Link to="/mobile" className="text-primary underline">Back to the app</Link></footer>
      </article>
    </main>
  );
}
