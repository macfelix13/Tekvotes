# TekVotes — Account & Environment Setup Instructions

> [!IMPORTANT]
> **Never paste secret keys into chat.** Put them only in Vercel/Supabase dashboards or a local `.env.local` file. Dashboard menus change over time, so follow the intent if a label differs.
> Use a **separate project per environment** (staging and production). Never test real payments in production.

Use a dedicated email you control long-term for these accounts (e.g. a company address, not a personal one).

## 0. Names to use
| Item | Name |
|------|------|
| GitHub repo | `tekvotes` (private) |
| Supabase projects | `tekvotes-staging`, `tekvotes-prod` |
| Vercel project | `tekvotes` |
| Local dev | Supabase CLI (local Docker), no cloud project needed |

## 1. Local tools (on your PC)
Install: **Node.js LTS**, **Git**, **Docker Desktop** (for local Supabase), **Supabase CLI**, **VS Code or your editor**. I can check what is already installed when we start.

## 2. GitHub
1. Create a **private** repository `tekvotes`.
2. Enable branch protection on `main` (require pull request + passing checks).
3. Turn on Dependabot alerts and secret scanning.

## 3. Supabase (create 2 projects)
1. Sign in at supabase.com, create an organization, then project `tekvotes-staging`.
2. Choose a region **closest to Ghana users** that is available to you (check latency; Europe is often the closest option). Region cannot be changed later.
3. Save the **database password** in a password manager.
4. From Project Settings → API note: Project URL, `anon` key (public), `service_role` key (**secret, server only**).
5. Repeat for `tekvotes-prod`. For production, check the plan includes **daily backups and point-in-time recovery** [verify on Supabase pricing page]; upgrade before launch if not.
6. Auth settings (both): enable email sign-in with email confirmation; set Site URL and redirect URLs once Vercel domains exist; enable MFA (TOTP).
7. Do **not** create tables by hand. All schema comes from migration files I will write.

## 4. Vercel
1. Sign in with GitHub and import the `tekvotes` repo.
2. Environments: Preview → staging variables; Production → production variables.
3. Add environment variables (below) per environment. Mark secrets as sensitive.
4. Note the project's default domain; later add your real domain and subdomain strategy (wildcard subdomains for events are a Phase 9 item).
5. Check function region and plan limits for long-running jobs [verify]; heavy jobs (PDF exports, reconciliation) may need a separate worker.

## 5. Paystack (test mode only for now)
1. Create a Paystack account and use **test mode** keys (`sk_test_…`, `pk_test_…`).
2. Business verification for live mode takes time; start it early.
3. **Critical open item (OD-07):** ask Paystack support in writing whether your account can collect for multiple independent organizations and pay them out later (transfers), whether Ghana mobile money supports refunds and transfers on your account, and about fee bearer settings. Keep their reply; it determines Phase 5.
4. Webhook URL (set later): `https://<staging-domain>/api/webhooks/paystack`.

## 6. Cloudinary
1. Create an account/cloud; create folders `tekvotes/staging` and `tekvotes/prod`.
2. Create **signed** upload presets (no unsigned). Restrict formats to jpg/png/webp/avif, set max file size.
3. Note cloud name, API key, API secret (secret, server only).

## 7. Email and SMS (decide later)
- **Email provider** (Resend, Postmark, SES…): needed before launch; Supabase default email is fine for development only.
- **SMS/OTP vendor with Ghana coverage and sender ID:** needed before Phase 4. Compare delivery, price, sender ID rules, webhooks.

## 8. Environment variables (names only)
| Variable | Where | Secret? |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | all | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all | no (public by design, protected by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | **yes** |
| `SUPABASE_DB_URL` | CI/migrations only | **yes** |
| `PAYSTACK_SECRET_KEY` | server only | **yes** |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | all | no |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` | server | no/low |
| `CLOUDINARY_API_SECRET` | server only | **yes** |
| `OTP_HMAC_PEPPER`, `CRON_SECRET`, `WEBHOOK_INTERNAL_TOKEN` | server only | **yes** (random 32+ bytes, I will give a generator command) |
| `APP_ENV` (`local`/`staging`/`production`) | all | no |
Rule: staging must refuse `sk_live_` keys (guard in code).

## 9. Super Admin bootstrap
First Super Admin: **frametek93@gmail.com**.
1. After staging is deployed, register that email normally through the app and confirm it.
2. I will provide a one-time migration/CLI command that inserts that user into `platform_staff` as `super_admin`. No UI path exists to self-promote.
3. Immediately enable MFA on that account. Use a password manager; consider a second recovery admin later.

## 10. Checklist to send me when done (no secrets)
- [ ] GitHub repo URL (private; I will need access method discussed)
- [ ] Supabase staging project created (region chosen: ___)
- [ ] Vercel project created and linked
- [ ] Cloudinary cloud created
- [ ] Paystack test account created; written question sent about OD-07
- [ ] Which email and SMS vendors you prefer (or "undecided")
