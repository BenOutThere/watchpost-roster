# Setting up your own copy

This is a copy of the Watchpost / OTG Event Security app that runs on accounts **you** own,
instead of inside Lovable. The features are the same. The only differences are behind the scenes:

- Emails (invites, password resets, variation alerts) send through **Resend** instead of Lovable's email service.
- All database changes live in one place, `supabase/migrations/`, so a brand-new Supabase project can be built from scratch.
- The database no longer has the old Lovable project's address written into it; it reads your project's address from two saved secrets.
- The 5-minute automatic sign-off job is now part of the setup (Lovable had set it up by hand).
- The demo event ("Summer Stadium Festival 2026") isn't created in a new project, because it relied on records that only exist in the old database.

You need four free accounts: **GitHub** (holds the code), **Supabase** (database and logins),
**Resend** (email) and **Vercel** (hosts the website). Tall Bob SMS details are still entered inside the app.

---

## 1. Supabase: create the project

1. Sign up at supabase.com and click **New project**. Pick the **Sydney** region and save the database password somewhere safe.
2. Open **Project Settings → API** and note three things: the **Project URL**, the **anon / publishable key**, and the **project ref** (the bit before `.supabase.co`).

## 2. Supabase: build the database and server functions

This step runs a few commands from a computer. Claude can do it for you on your Mac
(ask for a "Remote Control" session), or a developer can run:

```bash
npm install
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push            # builds all the tables, rules and scheduled jobs
npx supabase functions deploy   # uploads the 10 server functions
```

## 3. Supabase: secrets

**Vault** (Supabase → SQL Editor → paste, replace the two values, click Run). This lets the
database wake the email and SMS senders:

```sql
select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co', 'project_url');
select vault.create_secret('YOUR-ANON-OR-PUBLISHABLE-KEY', 'anon_key');
```

**Edge function secrets** (Supabase → Edge Functions → Secrets → Add):

| Name | What to put |
|---|---|
| `RESEND_API_KEY` | From Resend → API Keys |
| `SMS_CREDENTIALS_KEY` | A long random secret that locks the saved Tall Bob logins. Generate one with `openssl rand -base64 32` (Claude can make one for you). **Keep it safe: if it changes, Tall Bob details must be re-entered.** |
| `SEND_EMAIL_HOOK_SECRET` | Shown in step 5 |
| `EMAIL_FROM` | Optional. Defaults to `OTG Security Management <noreply@security.outthereadmin.com.au>` |

## 4. Resend: email

1. Sign up at resend.com → **Domains → Add domain** → `security.outthereadmin.com.au`.
2. Add the DNS records Resend shows you at your domain provider and wait for "Verified".
   (Until then, alert emails wait in a queue and retry every 15 minutes.)
3. Create an API key and save it as `RESEND_API_KEY` (step 3).

## 5. Supabase: login settings

1. **Authentication → URL Configuration**
   - Site URL: `https://security.outthereadmin.com.au`
   - Redirect URLs: add `https://security.outthereadmin.com.au/**`
2. **Authentication → Hooks → Send Email hook** → turn on → type **HTTPS** →
   URL `https://YOUR-PROJECT-REF.supabase.co/functions/v1/auth-email-hook`.
   Click **Generate secret**, copy it, and save it as `SEND_EMAIL_HOOK_SECRET` (step 3).
   This sends the branded login emails through Resend.

## 6. Vercel: the website

1. Sign up at vercel.com with GitHub → **Add New → Project** → choose this repository.
2. Under **Environment Variables** add the three values from `.env.example`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`).
3. Click **Deploy**. Every change pushed to GitHub redeploys automatically.
4. Page links (like `/admin/roster`) work thanks to `vercel.json`, already in this repo.
5. When you're ready to switch over, point `security.outthereadmin.com.au` at Vercel
   (Vercel → Settings → Domains shows the DNS record to add). Until then, test on the
   `.vercel.app` address. Invite links and guard QR posters always use the real domain.

## 7. Make yourself the first Super Admin

1. Open the website and sign up with your email.
2. In Supabase → SQL Editor, run (with your email):

```sql
DELETE FROM public.user_roles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
INSERT INTO public.user_roles (user_id, role) SELECT id, 'super_admin' FROM auth.users WHERE email = 'you@example.com';
```

3. Sign out and back in. You can now add events, providers and users from inside the app.

## 8. Phone apps

The iPhone and Android apps just open `https://security.outthereadmin.com.au/mobile`.
They keep working unchanged once that domain points at your new website.

## Moving your existing data (optional)

The current guards, events and users live in the Lovable-managed database. Copying them
across is a separate job; ask Claude when you're ready.
