# Ship now — paste-ready env block

Pulled from your live Supabase project `yge-prod` (ref
`ctynfpquaxxwxcaejlsk`) on 2026-05-06.

## What's in here

- ✅ Supabase project URL
- ✅ Supabase legacy anon + service-role JWTs (Phase 1 code uses these)
- ✅ Database connection strings (session pooler + transaction pooler — Render is IPv4-only on Starter so we use the pooler, not direct)
- ✅ Fresh `NEXTAUTH_SECRET` + `MOBILE_TOKEN_SECRET` (rolled with `openssl rand -hex 32`)
- ⚠️ Two values you still need to fill in:
  - `[YOUR-DB-PASSWORD]` — the Postgres password you set when creating the project. If you forgot it, click **Reset password** on Supabase → Database → Settings (no other connections to break yet).
  - `ANTHROPIC_API_KEY` — already in your `https://platform.claude.com/settings/keys` tab. Create a key named `yge-prod` if you don't have one.

## Step 1 — Render env tab

Open https://dashboard.render.com/web/srv-d7sftt67r5hc73e3mvq0/env and
paste each row (key, value) into the **Environment** tab. Render
auto-redeploys when you save.

```
DATABASE_URL = postgresql://postgres.ctynfpquaxxwxcaejlsk:[YOUR-DB-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres
NEXT_PUBLIC_SUPABASE_URL = https://ctynfpquaxxwxcaejlsk.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0eW5mcHF1YXh4d3hjYWVqbHNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODkzMDYsImV4cCI6MjA5MzQ2NTMwNn0.50Wm8CSEG6uHM2jDxW9DODeiFPShQH9Vig5thdt2vCw
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0eW5mcHF1YXh4d3hjYWVqbHNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODkzMDYsImV4cCI6MjA5MzQ2NTMwNn0.50Wm8CSEG6uHM2jDxW9DODeiFPShQH9Vig5thdt2vCw
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0eW5mcHF1YXh4d3hjYWVqbHNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg4OTMwNiwiZXhwIjoyMDkzNDY1MzA2fQ.kO4L8KOxicQBsqvzcHGvZB3JSeD7RdbpB6-G-UgL6m0
NEXTAUTH_SECRET = 3b029740b5bdf8f6a2349b6ee5d89b24a93983e02f58b396491a9e03c05a3236
MOBILE_TOKEN_SECRET = ab059970841fe50a8ee8f466b2ab4f27c4ef19486134e7d9304ccad122f5fb7e
ANTHROPIC_API_KEY = [paste from platform.claude.com]
NEXT_PUBLIC_API_URL = https://api.youngge.com
```

The DATA_DIR vars in `render.yaml` already give every file-store a
location on the 5GB persistent disk — Render handles those.

## Step 2 — Vercel env vars

Open https://vercel.com/ryanyoung-yges-projects/yge-app-web/settings/environment-variables
and add each row for **Production** (and optionally Preview):

```
NEXT_PUBLIC_API_URL = https://api.youngge.com
NEXT_PUBLIC_SUPABASE_URL = https://ctynfpquaxxwxcaejlsk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0eW5mcHF1YXh4d3hjYWVqbHNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODkzMDYsImV4cCI6MjA5MzQ2NTMwNn0.50Wm8CSEG6uHM2jDxW9DODeiFPShQH9Vig5thdt2vCw
NEXTAUTH_SECRET = 3b029740b5bdf8f6a2349b6ee5d89b24a93983e02f58b396491a9e03c05a3236
```

Vercel only needs the public-facing keys + the API URL. The web app
talks to the API for everything sensitive.

## Step 3 — Local: run the initial Postgres migration

From your laptop, in `~/Documents/Claude/Estimating Software/Estimating Software/yge-app/`:

```bash
# Use the TRANSACTION pooler for migrations — runs as a one-off
# command, doesn't need a long-lived session.
export DATABASE_URL='postgresql://postgres.ctynfpquaxxwxcaejlsk:[YOUR-DB-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'

pnpm --filter @yge/db exec prisma migrate deploy
pnpm --filter @yge/db exec prisma db seed
```

`prisma migrate deploy` creates every table from `packages/db/prisma/schema.prisma`
(60+ tables: estimates, jobs, vendors, the 40 new Phase-1 models in
bundle 1345, AuditEvent, etc.). `prisma db seed` populates Brook +
Ryan as portal users + the YGE company record + the cost-codes
starter set.

## Step 4 — Squarespace DNS

Open https://account.squarespace.com/domains/managed/youngge.com/dns/dns-settings
and add (or verify) two CNAMEs:

```
Host  Type   Data
app   CNAME  cname.vercel-dns.com
api   CNAME  yge-api.onrender.com
```

TTL 600 is fine. Propagation usually 5–15 min; check with
`dig app.youngge.com CNAME +short`.

After DNS resolves, in Vercel: **Settings → Domains → Add → app.youngge.com**
(it'll auto-issue a Let's Encrypt cert). Same in Render: **Custom
Domains → api.youngge.com**.

## Step 5 — Smoke test

```bash
# Health
curl https://api.youngge.com/health
# → { "ok": true }

# Auth
open https://app.youngge.com/login
# Sign in as ryoung@youngge.com (the seed-set portal user). First time
# you'll be prompted to set a password.

# AI flagship
open https://app.youngge.com/plans-to-estimate
# Drop in a plan PDF or paste an RFP paragraph. Confirm a draft comes
# back in <30s.

# PDF form filler
open https://app.youngge.com/pdf-forms
# 15 forms in the library. Open W-9 → Generate → confirm Brook /
# Ryan / EIN / address auto-fill from master profile.
```

## Step 6 (optional) — Microsoft SSO

Only needed if you want office staff to sign in with their Microsoft
Entra account instead of email + password. Open
https://entra.microsoft.com → **App registrations** → **New registration**:

- Name: `YGE App`
- Supported account types: **Accounts in this organizational directory only**
- Redirect URI (Web): `https://api.youngge.com/api/microsoft/callback`

After registering, copy these values into Render env:

```
MICROSOFT_CLIENT_ID = [Application (client) ID]
MICROSOFT_CLIENT_SECRET = [from Certificates & secrets → New client secret]
MICROSOFT_TENANT_ID = [Directory (tenant) ID]
MICROSOFT_REDIRECT_URI = https://api.youngge.com/api/microsoft/callback
```

Phase 1 works fine without this — the email/password + WebAuthn passkey
flow is enough for Brook + Ryan.

## Step 7 (optional) — Browser extension submissions

Built zips ready in:

```
apps/browser-extension/dist/yge-extension-chrome-v0.1.0.zip
apps/browser-extension/dist/yge-extension-edge-v0.1.0.zip
apps/browser-extension/dist/yge-extension-firefox-v0.1.0.zip
```

See `apps/browser-extension/docs/SUBMIT.md` for the per-store flow.
Order by ease: Edge → Firefox → Chrome → Safari (Safari needs Xcode).

Listing copy is pre-written in `apps/browser-extension/store/listing-copy.md`.

## Quick rollback

If anything goes wrong post-deploy:

- **Render**: rollback via dashboard → Deploys → previous → **Redeploy**.
- **Vercel**: rollback via dashboard → Deployments → previous → **Promote to Production**.
- **Database**: Supabase keeps daily backups (free tier = 7 days).
  Restore via project → Database → Backups → **Restore**.
