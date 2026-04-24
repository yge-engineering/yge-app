# Kickoff — Push the Scaffold to GitHub

The code is scaffolded on your Mac at this folder. To move it to GitHub under your `yge-engineering` organization, run these commands in **Terminal** (Applications → Utilities → Terminal) one block at a time. Anything inside backticks you copy/paste exactly. Any line starting with `#` is a comment explaining what the next command does — do not paste the comment lines.

## 1. Clean up the broken .git folder

I started a git repo inside the sandbox but the sandbox filesystem couldn't finish. There's a half-baked `.git/` folder in your yge-app folder that needs to be removed before we start fresh.

```bash
cd "$HOME/Documents/Claude/Estimating Software/yge-app"

# Remove the partial git directory
rm -rf .git
```

(Per your rule about never deleting files without approval: this is a throwaway metadata folder, not source code. But you're running the command, so it's your call.)

## 2. Initialize a fresh repo and make the first commit

```bash
cd "$HOME/Documents/Claude/Estimating Software/yge-app"

git init -b main
git config user.email "ryoung@youngge.com"
git config user.name "Ryan Young"
git add -A
git commit -m "Initial scaffold — YGE App Phase 1 MVP"
```

You should see something like `[main (root-commit) xxxxxxx] Initial scaffold…` with 46 files changed.

## 3. Create the repo on GitHub

Open https://github.com/organizations/yge-engineering/repositories/new and fill in:

- **Repository name:** `yge-app`
- **Description:** `Estimating, job management, and bookkeeping platform for Young General Engineering.`
- **Visibility:** **Private** (important — it will hold real rate data, bids, and employee info)
- **Initialize with README / .gitignore / license:** leave ALL three **unchecked**. The scaffold already has them.

Click **Create repository**.

## 4. Push the scaffold

GitHub will show you a "…or push an existing repository from the command line" block. Use these commands (they assume you've added an SSH key to GitHub; if not, use the HTTPS variant GitHub shows you instead):

```bash
cd "$HOME/Documents/Claude/Estimating Software/yge-app"

git remote add origin git@github.com:yge-engineering/yge-app.git
git push -u origin main
```

If you don't have an SSH key on this Mac yet, use this instead:

```bash
git remote add origin https://github.com/yge-engineering/yge-app.git
git push -u origin main
```

GitHub will prompt for your username and a Personal Access Token (not your password — token only). If you don't have a PAT yet, go to https://github.com/settings/tokens → "Generate new token (classic)" → select the `repo` scope → generate → copy the token and paste it as the password when prompted.

## 5. Tell me the repo URL

Once the push succeeds, send me the repo URL (it'll be `https://github.com/yge-engineering/yge-app`) so I can reference it going forward.

## What's in the scaffold

```
yge-app/
├── CLAUDE.md               ← instructions for Claude Code when working in this repo
├── README.md
├── package.json            ← pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json              ← Turborepo build orchestration
├── tsconfig.base.json
├── docker-compose.yml      ← local Postgres
├── .env.example            ← template for your .env (never commit the real .env)
├── .gitignore
├── .prettierrc
├── .github/workflows/ci.yml
│
├── apps/
│   ├── web/                ← Next.js 14 office web app (the main YGE interface)
│   │   └── src/app/        ← dashboard, jobs, estimates routes
│   ├── api/                ← Node/Express API server (talks to Postgres + Anthropic)
│   │   └── src/routes/     ← health, jobs, estimates, plans-to-estimate
│   └── mobile/             ← React Native / Expo (Phase 2 — empty for now)
│
├── packages/
│   ├── db/                 ← Prisma schema + seeded YGE tenant
│   │   └── prisma/schema.prisma   ← the data model
│   ├── shared/             ← shared TypeScript used by web + API + mobile
│   │   └── src/            ← money, rate math, estimate rollup, Zod schemas
│   └── ui/                 ← shared React components (Phase 1 weeks 3+)
│
└── seeds/
    ├── dir/                ← CA DIR prevailing wage PDFs go here
    └── excel-master/       ← YGE Excel export goes here
```

## Immediate next steps after push

1. **Install Node + pnpm on this Mac** (if not already):
   ```bash
   # Node 20 via nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   nvm install 20
   nvm use 20
   # pnpm
   npm install -g pnpm
   ```
2. **Install Docker Desktop** (for local Postgres): https://www.docker.com/products/docker-desktop/
3. **Install dependencies and fire it up:**
   ```bash
   cd "$HOME/Documents/Claude/Estimating Software/yge-app"
   pnpm install
   docker compose up -d
   cp .env.example .env
   # Edit .env and paste your Anthropic API key on the ANTHROPIC_API_KEY line
   pnpm db:migrate
   pnpm db:seed
   pnpm dev
   ```
4. **Open http://localhost:3000 in your browser.** You should see the YGE App home page.

None of this is urgent today — the Sulphur Springs bid Tuesday comes first. But it's ready when you are, and I can pick up from any step.
