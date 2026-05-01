# Deploying yge-app to Vercel

Plain English: how to get the web app live at app.youngge.com.

## One-time setup (5–15 minutes)

### 1. Sign up for Vercel

Go to https://vercel.com and click "Sign up". Use your GitHub account (the same `ryanyoung-yge` you push from). The Hobby plan is free and is enough for a small team.

### 2. Import the repo

- Click **Add New… → Project** in the Vercel dashboard.
- Pick `yge-engineering/yge-app` from the list. (Since the repo is public, Vercel can see it without you granting any extra access.)
- Vercel will ask for a "Root Directory". Set it to `apps/web`. That's the Next.js app.
- Vercel reads the `apps/web/vercel.json` file in the repo and auto-fills the Build Command and Install Command. Don't change those — they're written to handle the pnpm workspace correctly.
- Leave Output Directory blank. Next.js auto-detects.
- Click **Deploy**.

The first build takes ~3–5 minutes (it has to install all packages and compile TypeScript across the monorepo). Subsequent deploys are 60–90 seconds.

### 3. Wait for the green check

When the build is done, Vercel will give you a URL like `yge-app.vercel.app`. Click it. You should land on `/login` (because the auth middleware redirects you).

Type `ryoung@youngge.com`, click Sign in, you're on the dashboard.

### 4. Point app.youngge.com at Vercel

This is the only step that touches Squarespace.

- In Vercel, open the project → **Settings → Domains**. Click **Add**.
- Type `app.youngge.com`. Vercel will show you DNS records you need to add at your registrar.
- For a Squarespace-managed domain, the record will be a CNAME pointing `app` to `cname.vercel-dns.com`. Follow Squarespace's "Add a custom CNAME" guide.
- DNS propagation usually takes 10–60 minutes. Vercel automatically issues an SSL certificate once DNS resolves. After that, https://app.youngge.com is live.

## Environment variables

Once the app is real, set these in Vercel **Settings → Environment Variables** (Production, Preview, Development):

| Variable                      | Value (production)                          | Notes                                          |
| ----------------------------- | ------------------------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_API_URL`         | `https://api.youngge.com` (when API is up)  | Where dashboard fetches data from              |
| `API_URL`                     | same as above                               | Server-side variant                            |
| `NEXT_PUBLIC_SUPABASE_URL`    | leave empty for now                         | Set when wiring real Supabase Auth             |
| `SUPABASE_ANON_KEY`           | leave empty for now                         | Set when wiring real Supabase Auth             |

Until the API is deployed somewhere, the dashboard tiles will show "0" / "—" because there's no backend serving data. That's expected.

## Auto-deploy from main

Every push to `main` on GitHub triggers a new Vercel deploy automatically. The autopilot pipeline shipping commits in the queue will roll out new code within a couple minutes of each push.

## Rollback

If a deploy breaks something, Vercel keeps the last 30 builds. **Settings → Deployments** lists them all; click any build's "..." menu → Promote to Production. Site is back in 5 seconds.

## Cost

Hobby plan is free up to 100 GB bandwidth/month and unlimited builds. For a 5-person internal tool that's more than you'll ever use. If you outgrow it, the Pro plan is $20/user/month.
