import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Topic { title: string; body: React.ReactNode }

const TOPICS: Topic[] = [
  {
    title: 'The web app is down',
    body: (
      <>
        <p>Check <Link href="/admin/health-check" className="text-yge-blue-700 hover:underline">/admin/health-check</Link> or
        {' '}<Link href="/admin/health-extended" className="text-yge-blue-700 hover:underline">/admin/health-extended</Link>.</p>
        <p>If the API is healthy but the web app fails, it is usually a Vercel deploy issue. Look at the latest commit at
        {' '}<Link href="/admin/build-info" className="text-yge-blue-700 hover:underline">/admin/build-info</Link>.</p>
      </>
    ),
  },
  {
    title: 'A page shows "Loading…" forever',
    body: (
      <>
        <p>The browser couldn't reach the API. Check the API base URL at <Link href="/admin/system-info" className="text-yge-blue-700 hover:underline">/admin/system-info</Link>.</p>
        <p>Verify the API is up at <Link href="/admin/api-test" className="text-yge-blue-700 hover:underline">/admin/api-test</Link> (one-click ping of every endpoint).</p>
      </>
    ),
  },
  {
    title: 'Master data looks wrong',
    body: (
      <>
        <p>Sanity-check totals at <Link href="/admin/data-status" className="text-yge-blue-700 hover:underline">/admin/data-status</Link>.</p>
        <p>If a table is empty: see <Link href="/admin/empty-tables" className="text-yge-blue-700 hover:underline">/admin/empty-tables</Link> — usually means a recent CSV import wiped or missed records.</p>
        <p>Cleanup buckets at <Link href="/admin/data-quality-counts" className="text-yge-blue-700 hover:underline">/admin/data-quality-counts</Link>.</p>
      </>
    ),
  },
  {
    title: 'Bulk-import customers / vendors / etc.',
    body: (
      <>
        <p>Use <Link href="/admin/csv-imports" className="text-yge-blue-700 hover:underline">/admin/csv-imports</Link>. Every importer supports a dry-run preview before committing writes.</p>
        <p>Existing rows: download a starter CSV from the importer page, edit, re-upload.</p>
      </>
    ),
  },
  {
    title: 'Need to brief an outside person',
    body: (
      <>
        <p>Send them <Link href="/admin/yge-context" className="text-yge-blue-700 hover:underline">/admin/yge-context</Link> first, then <Link href="/portfolio" className="text-yge-blue-700 hover:underline">/portfolio</Link>.</p>
        <p>Print <Link href="/help/cheatsheet" className="text-yge-blue-700 hover:underline">/help/cheatsheet</Link> if they prefer paper.</p>
      </>
    ),
  },
  {
    title: 'Where is the audit log?',
    body: (
      <>
        <p>Server-side every mutation is captured by the middleware. UI viewer is in progress; preview at
        {' '}<Link href="/admin/audit-log-preview" className="text-yge-blue-700 hover:underline">/admin/audit-log-preview</Link>.</p>
      </>
    ),
  },
];

export default function RunbookPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Runbook" subtitle="Common operations procedures." />
        <div className="space-y-3">
          {TOPICS.map((t, i) => (
            <details key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold text-gray-900">{t.title}</summary>
              <div className="mt-2 space-y-2 text-sm text-gray-700">{t.body}</div>
            </details>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
