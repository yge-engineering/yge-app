# Ship now — paste-ready env block

Pulled from your live Supabase project `yge-prod` (ref
`ctynfpquaxxwxcaejlsk`). Updated 2026-05-06 after the
DATABASE_URL / DIRECT_URL split landed in bundle 1364.

## What's in here

- ✅ Supabase project URL + anon JWT (legacy format)
- ✅ Pooler connection strings (transaction 6543 for runtime, session 5432 for migrations)
- ✅ Fresh `NEXTAUTH_SECRET` + `MOBILE_TOKEN_SECRET` (rolled with `openssl rand -hex 32`)
- ⚠️ Two values you fill in yourself:
  - `[YOUR-DB-PASSWORD]` — set when you created the Supabase project. Forgot it? Click **Reset password** on Supabase → Database → Settings (no other connections to break yet, fresh DB).
  - `ANTHROPIC_API_KEY` — paste your `sk-ant-api03-...` key from `https://platform.claude.com/settings/keys`.
  - **(optional)** `SUPABASE_SERVICE_ROLE_KEY` — only needed if/when Supabase Auth or storage gets wired in. Phase 1 doesn't read it. Skip for now.

## The two pooler URLs (why)

- **Transaction pooler** `:6543` (PgBouncer in TX mode) — for the API's
  runtime queries. Render Starter is IPv4-only, Supabase free
  direct connection is IPv6-only, so the pooler is mandatory.
- **Session pooler** `:5432` — for `prisma migrate deploy` and
  `prisma db seed`, which use prepared statements + advisory locks
  the transaction pooler strips out. Bundle 1364 added
  `directUrl = env("DIRECT_URL")` to schema.prisma so Prisma reads
  the right one for each operation.

## Step 1 — Render env tab

Open https://dashboard.render.com/web/srv-d7sftt67r5hc73e3mvq0/env
and paste each row (key, value):

```
NODE_VERSION = 20
DEFAULT_COMPANY_ID = yge-root
DATABASE_URL = postgresql://postgres.ctynfpquaxxwxcaejlsk:[YOUR-DB-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL = postgresql://postgres.ctynfpquaxxwxcaejlsk:[YOUR-DB-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres
NEXT_PUBLIC_SUPABASE_URL = https://ctynfpquaxxwxcaejlsk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_BN0uWccUfGUKjsFXqR4sKw_rZgKOdGh
NEXTAUTH_SECRET = 3b029740b5bdf8f6a2349b6ee5d89b24a93983e02f58b396491a9e03c05a3236
MOBILE_TOKEN_SECRET = ab059970841fe50a8ee8f466b2ab4f27c4ef19486134e7d9304ccad122f5fb7e
ANTHROPIC_API_KEY = sk-ant-api03-...   # your prod key from console.anthropic.com
NEXT_PUBLIC_API_URL = https://api.youngge.com
```

The DATA_DIR vars in `render.yaml` already give every file-store a
location on the 5GB persistent disk — Render handles those.

`DEFAULT_COMPANY_ID=yge-root` matches what `prisma db seed` writes
(it's also the default in code — bundle 1363 aligned everything).

## Step 2 — Vercel env vars

Open https://vercel.com/ryanyoung-yges-projects/yge-app-web/settings/environment-variables
and add for **Production** (Preview gets the same):

```
NEXT_PUBLIC_API_URL = https://api.youngge.com
NEXT_PUBLIC_SUPABASE_URL = https://ctynfpquaxxwxcaejlsk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_BN0uWccUfGUKjsFXqR4sKw_rZgKOdGh
NEXTAUTH_SECRET = 3b029740b5bdf8f6a2349b6ee5d89b24a93983e02f58b396491a9e03c05a3236
```

Vercel only needs the public-facing keys + the API URL. Sensitive
work happens server-side on Render.

## Step 3 — Run the migration from your laptop

```bash
cd ~/Documents/Claude/Estimating\ Software/Estimating\ Software/yge-app

export DATABASE_URL='postgresql://postgres.ctynfpquaxxwxcaejlsk:[YOUR-DB-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'
export DIRECT_URL='postgresql://postgres.ctynfpquaxxwxcaejlsk:[YOUR-DB-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres'

pnpm --filter @yge/db exec prisma migrate deploy
pnpm --filter @yge/db exec prisma db seed
```

What this does:

- `migrate deploy` creates every table from `packages/db/prisma/schema.prisma`
  (60+ tables — estimates, jobs, vendors, the 40 Phase-1 models added
  in bundle 1345, AuditEvent, etc.).
- `db seed` populates Brook + Ryan as portal users, the YGE company
  record (id `yge-root`), and the cost-codes starter set.

After it succeeds, you can verify with the Supabase Table Editor —
you should see `companies`, `users`, `officers`, `portal_users`,
`vendors`, `master_profiles`, etc. all present.

## Step 4 — Squarespace DNS

Open https://account.squarespace.com/domains/managed/youngge.com/dns/dns-settings
and add (or verify) two CNAMEs:

| Host | Type  | Data                       |
|------|-------|----------------------------|
| app  | CNAME | cname.vercel-dns.com       |
| api  | CNAME | yge-api.onrender.com       |

TTL 600 is fine. Check propagation with:

```bash
dig app.youngge.com CNAME +short
dig api.youngge.com CNAME +short
```

After those resolve:

- **Vercel** → Settings → Domains → Add → `app.youngge.com` (auto Let's Encrypt)
- **Render** → Custom Domains → Add → `api.youngge.com` (auto Let's Encrypt)

## Step 5 — Smoke test

```bash
# API health
curl https://api.youngge.com/health
# expect: { "ok": true }

# Web login
open https://app.youngge.com/login
# Sign in as ryoung@youngge.com (seeded portal user). First time
# you'll be prompted to set a password.

# AI flagship — confirms ANTHROPIC_API_KEY is wired
open https://app.youngge.com/plans-to-estimate
# Drop a plan PDF or paste an RFP paragraph; expect a draft in <30s.

# PDF form filler — confirms master profile + form library
open https://app.youngge.com/pdf-forms
# 15 forms seeded. Open W-9, click Generate, verify Brook / Ryan /
# EIN / address auto-fill.
```

## Step 6 (optional) — Microsoft SSO

Only if office staff want to sign in with Microsoft Entra. In your
already-open Entra tab:

- **App registrations → New registration**
- Name: `YGE App`
- Account types: **Accounts in this organizational directory only**
- Redirect URI (Web): `https://api.youngge.com/api/microsoft/callback`

Then in Render env, add:

```
MICROSOFT_CLIENT_ID = [Application (client) ID]
MICROSOFT_CLIENT_SECRET = [Certificates & secrets → New client secret]
MICROSOFT_TENANT_ID = [Directory (tenant) ID]
MICROSOFT_REDIRECT_URI = https://api.youngge.com/api/microsoft/callback
```

Phase 1 works fine without this — email/password + WebAuthn passkey
covers Brook + Ryan.

## Step 7 (optional) — Browser extension submissions

Three store-ready zips already built:

```
apps/browser-extension/dist/yge-extension-chrome-v0.1.0.zip
apps/browser-extension/dist/yge-extension-edge-v0.1.0.zip
apps/browser-extension/dist/yge-extension-firefox-v0.1.0.zip
```

Submit per `apps/browser-extension/docs/SUBMIT.md`. Listing copy is
pre-written in `apps/browser-extension/store/listing-copy.md`.

Order by ease: **Edge** (free, 2-4 day review) → **Firefox** (free,
auto-review usually instant) → **Chrome** ($5 one-time, 1-3 day) →
**Safari** (Apple Developer $99/yr + Xcode wrap, slowest).

## Quick rollback

- **Render**: Deploys → previous → **Redeploy**
- **Vercel**: Deployments → previous → **Promote to Production**
- **Database**: Supabase → Database → Backups → **Restore** (free tier keeps 7 days)
