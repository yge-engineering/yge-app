// /changelog — what's new in YGE.
//
// Plain English: a hand-curated list of recent meaningful changes,
// written in plain English (not git commit messages). When you ship
// something users should know about, add a row to RELEASE_NOTES below.

import { AppShell, Card, PageHeader } from '../../components';

interface ReleaseNote {
  date: string; // yyyy-mm-dd
  title: string;
  body: string;
}

const RELEASE_NOTES: ReleaseNote[] = [
  {
    date: '2026-05-01',
    title: 'Search box in the header',
    body: 'Type from any page to find a job, customer, vendor, or employee by name. Results group by entity type.',
  },
  {
    date: '2026-05-01',
    title: 'Recent activity feed on the dashboard',
    body: 'See the most-recently created or updated jobs, AR invoices, AP invoices, RFIs, and dispatches in one card. Relative timestamps, click any row to jump to the record.',
  },
  {
    date: '2026-05-01',
    title: 'Quick actions on the dashboard',
    body: 'Four shortcut cards above the tile board for the things you do most: New job, New daily report, New AR invoice, New time card.',
  },
  {
    date: '2026-05-01',
    title: 'Help page',
    body: 'Plain-English how-tos for starting a bid, logging a daily report, sending an AR invoice, and running weekly certified payroll. Plus a 5-question FAQ. In the sidebar under More.',
  },
  {
    date: '2026-05-01',
    title: 'Profile page',
    body: 'Click your name in the upper-right to see your account info and the YGE company info that prints on every document.',
  },
  {
    date: '2026-05-01',
    title: 'All-modules directory',
    body: 'Linked from the sidebar (More → All modules). Every page in the app, grouped by what hat you\'re wearing. Use it as a cheat-sheet for finding things not in the daily nav.',
  },
  {
    date: '2026-05-01',
    title: '404 page',
    body: 'Dead links now land on a friendly "page not found" with quick links back to the dashboard or the all-modules directory.',
  },
  {
    date: '2026-05-01',
    title: 'API not reachable banner',
    body: 'When the API server isn\'t responding, the dashboard shows a friendly amber banner explaining what\'s wrong and how to fix it, instead of silently showing zeros.',
  },
  {
    date: '2026-05-01',
    title: 'Vercel deployment ready',
    body: 'Repository now contains a Vercel config and a plain-English DEPLOY.md guide. ~10 minutes to get a live URL at app.youngge.com.',
  },
  {
    date: '2026-04-30',
    title: 'Sign-in works',
    body: 'Type your work email at /login, hit Sign in, you\'re on the dashboard. Email allowlist for now (Brook + Ryan); Supabase Auth lands later.',
  },
  {
    date: '2026-04-30',
    title: 'Consistent app chrome on every page',
    body: 'Every page wears the same branded header (YGE logo, license/DIR numbers) + sidebar nav + account chip. Click around — it stays consistent.',
  },
  {
    date: '2026-04-30',
    title: 'Punch list + employees pages',
    body: 'Two pages that the sidebar previously linked but didn\'t actually exist. Now they do. Punch list shows open items oldest-first with red rows for overdue.',
  },
  {
    date: '2026-04-29',
    title: 'Customer / vendor / job aging breakouts',
    body: 'Per-customer per-job AR aging buckets (0-30, 31-60, 61-90, 91+). Mirror reports for AP. The kind of report you hand a banker.',
  },
];

export default function ChangelogPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="What's new"
          subtitle="Plain-English notes on recent changes. Newest first."
        />

        <ol className="space-y-3">
          {RELEASE_NOTES.map((n, i) => (
            <li key={i}>
              <Card>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-semibold text-gray-900">{n.title}</h2>
                  <span className="shrink-0 text-[11px] uppercase tracking-wider text-gray-500">{n.date}</span>
                </div>
                <p className="mt-1 text-sm text-gray-700">{n.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </main>
    </AppShell>
  );
}
