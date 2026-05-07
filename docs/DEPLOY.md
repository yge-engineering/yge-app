# YGE App — production deploy runbook

Plain-English steps to take this from local-dev to live at
`app.youngge.com`. Order matters: provision the database first, then
the API, then the web, then DNS.

## 0. Prerequisites

- A Supabase account (free tier is enough to start)
- A Render account (Starter plan, $7/mo for the API)
- A Vercel account (free tier; web is static + serverless)
- A Squarespace login that controls `youngge.com` DNS
- An Anthropic API key with billing enabled

## 1. Provision Supabase (≈10 min)

1. Sign in at https://app.supabase.com → **New project**.
2. Name: `yge-prod`. Region: `us-west-1` (Oregon — same as Render).
3. Database password: generate a strong one and save it to 1Password.
4. Wait ~3 min for provisioning.
5. **Project Settings → Database → Connection string → URI** — copy
   the **pooled** connection string (port `6543`). Append
   `?pgbouncer=true&connection_limit=1` for serverless safety.
6. **Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (server-side only —
      never expose to browser)

## 2. Run the initial migration

From your local repo:

```bash
# .env should hold the Supabase DATABASE_URL
pnpm --filter @yge/db exec prisma migrate deploy
pnpm --filter @yge/db exec prisma db seed
```

The seed populates Brook + Ryan as portal users, the YGE company
record, the master-profile starter, and the cost-codes table. Run it
once.

## 3. Deploy the API to Render

1. Push this repo to GitHub if not already there.
2. https://dashboard.render.com → **New +** → **Blueprint**
3. Point at the repo URL. Render reads `render.yaml` and proposes
   the `yge-api` service.
4. Click **Apply**. The service will fail its first build because
   env vars are missing. That's expected.
5. **Service → Environment**: paste each `sync: false` value:
   - `ANTHROPIC_API_KEY` from console.anthropic.com
   - `DATABASE_URL` from Supabase (step 1.5)
   - `NEXTAUTH_SECRET` and `MOBILE_TOKEN_SECRET` — generate with
     `openssl rand -hex 32`
   - The Supabase keys from step 1.6
   - Microsoft SSO secrets (optional — see `docs/MICROSOFT_SSO.md`)
6. Click **Manual Deploy → Deploy latest commit**.
7. Wait for **Live**. Health check: `curl https://yge-api.onrender.com/health`
   should return `{ ok: true }`.

## 4. Deploy the web app to Vercel

1. https://vercel.com/new → import the GitHub repo.
2. **Root Directory**: `apps/web`. Vercel auto-detects Next.js.
3. **Environment Variables** — paste from `.env.production.example`:
   - `NEXT_PUBLIC_API_URL=https://yge-api.onrender.com` (or the
     custom domain once DNS is up)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXTAUTH_SECRET`
4. **Deploy**. The first build takes ~3 min.

## 5. Wire DNS

In Squarespace's domain manager for `youngge.com`:

1. Add `CNAME` `app` → `cname.vercel-dns.com` (TTL 600).
2. Add `CNAME` `api` → `yge-api.onrender.com` (TTL 600).
3. Wait 5–15 min for propagation.
4. In Vercel: **Domains → Add → app.youngge.com**, follow verification.
5. In Render: **Custom Domains → Add → api.youngge.com**.

Both will auto-provision Let's Encrypt certs in ~5 min.

## 6. Smoke test

```bash
# Health
curl https://api.youngge.com/health

# Auth (allowlist users)
open https://app.youngge.com/login
# Sign in as ryoung@youngge.com, then brookyoung@youngge.com.

# Plans-to-Estimate (the AI flagship)
open https://app.youngge.com/plans-to-estimate
# Paste a paragraph; verify a draft comes back in <30s.

# PDF form filler
open https://app.youngge.com/pdf-forms
# Open W-9, verify it auto-fills from master-profile.
```

## 7. Production hardening (after smoke test passes)

- Sentry DSN set on both Render + Vercel
- Daily Postgres backup verified (Supabase → Database → Backups)
- Render service set to "Auto-Deploy: on" only for `main`
- Vercel git integration scoped to `main`
- Add Brook + office staff as portal users via `/admin/portal-users`

## 8. Browser extension

See `apps/browser-extension/README.md` for the per-store submission
flow. Order: Edge → Chrome → Firefox → Safari (Safari is the slow one,
needs Xcode wrapper).

## Troubleshooting

- **Render build fails on "prisma generate"** — make sure the build
  command runs `pnpm --filter @yge/db exec prisma generate` before
  `@yge/api build`. The `render.yaml` already does this.
- **Web 500 on first load** — usually `DATABASE_URL` missing from
  Vercel env vars. Set it under Settings → Environment Variables.
- **OAuth callback URL mismatch** — Microsoft + Google SSO need
  exact-match redirect URIs in their respective consoles. Update both
  if you change the API hostname.
- **Cold-start latency** — Render starter plan sleeps after 15 min
  idle. Either upgrade to Standard ($25/mo, no sleeping), or add a
  cron-based ping every 10 min from a separate uptime service.
