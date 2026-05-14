import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Step { n: number; title: string; description: string }

const STEPS: Step[] = [
  { n: 1, title: 'Local edit', description: 'New code added under apps/web/* or apps/api/*; shared types under packages/shared/*.' },
  { n: 2, title: 'Typecheck + tests', description: 'pnpm --filter @yge/shared test (Vitest) + pnpm --filter @yge/web typecheck (tsc --noEmit).' },
  { n: 3, title: 'Git commit', description: 'Commit message describes the user-visible change (feat / fix / chore / etc).' },
  { n: 4, title: 'Git push origin main', description: 'Push triggers both Vercel (web) and Render (api) deploys.' },
  { n: 5, title: 'Vercel deploy (web)', description: 'Vercel builds Next.js, runs server-side rendering as needed, and rolls out at app.youngge.com.' },
  { n: 6, title: 'Render deploy (api)', description: 'Render builds the Express server and rolls it out at api.youngge.com.' },
  { n: 7, title: 'Health check', description: 'Visit /admin/health-check or /admin/health-extended to confirm both services are responding.' },
];

export default function BuildPipelinePage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Build pipeline" subtitle="How a commit on main becomes live deployments on Vercel + Render." />
        <ol className="space-y-3">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-baseline gap-3">
                <span className="shrink-0 rounded bg-yge-blue-100 px-2 py-0.5 text-xs font-mono text-yge-blue-700">{s.n}</span>
                <h2 className="text-sm font-semibold text-gray-900">{s.title}</h2>
              </div>
              <p className="ml-9 mt-1 text-sm text-gray-700">{s.description}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-gray-500">
          Auto-runs on every commit. The bundle pipeline at <code className="rounded bg-gray-100 px-1">~/Documents/Claude/Estimating Software/queue/</code>
          {' '}executes steps 2–4 in series for each <code className="rounded bg-gray-100 px-1">.sh</code> file dropped into it. Check
          {' '}<Link href="/admin/release-notes" className="text-yge-blue-700 hover:underline">/admin/release-notes</Link> for the recent ship summary.
        </p>
      </main>
    </AppShell>
  );
}
