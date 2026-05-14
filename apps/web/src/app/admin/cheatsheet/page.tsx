import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function AdminCheatsheetPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Admin cheat sheet" subtitle="Where to go for any admin task." />

        <div className="space-y-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <section>
            <h2 className="text-sm font-semibold text-gray-900">Master data</h2>
            <ul className="ml-6 list-disc text-sm text-gray-700">
              <li><Link href="/admin/data-overview" className="text-yge-blue-700 hover:underline">/admin/data-overview</Link> — record counts side-by-side with browse / new / import / export links</li>
              <li><Link href="/admin/data-status" className="text-yge-blue-700 hover:underline">/admin/data-status</Link> — entity-count table</li>
              <li><Link href="/admin/data-summary" className="text-yge-blue-700 hover:underline">/admin/data-summary</Link> — clickable tile dashboard</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Cleanup</h2>
            <ul className="ml-6 list-disc text-sm text-gray-700">
              <li><Link href="/admin/data-quality-hub" className="text-yge-blue-700 hover:underline">/admin/data-quality-hub</Link> — every missing-* view</li>
              <li><Link href="/admin/data-quality-counts" className="text-yge-blue-700 hover:underline">/admin/data-quality-counts</Link> — counts of every missing-* bucket</li>
              <li><Link href="/admin/data-health" className="text-yge-blue-700 hover:underline">/admin/data-health</Link> — sanity-check rule failures</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Import / Export</h2>
            <ul className="ml-6 list-disc text-sm text-gray-700">
              <li><Link href="/admin/csv-imports" className="text-yge-blue-700 hover:underline">/admin/csv-imports</Link> — bulk CSV importers</li>
              <li><Link href="/admin/csv-exports" className="text-yge-blue-700 hover:underline">/admin/csv-exports</Link> — one-click CSV exports</li>
              <li><Link href="/admin/excel-import" className="text-yge-blue-700 hover:underline">/admin/excel-import</Link> — legacy Excel master sheets</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">System</h2>
            <ul className="ml-6 list-disc text-sm text-gray-700">
              <li><Link href="/admin/health-check" className="text-yge-blue-700 hover:underline">/admin/health-check</Link> — friendly /api/admin/health</li>
              <li><Link href="/admin/build-info" className="text-yge-blue-700 hover:underline">/admin/build-info</Link> — current build env</li>
              <li><Link href="/admin/server-time" className="text-yge-blue-700 hover:underline">/admin/server-time</Link> — server local time + tz</li>
              <li><Link href="/admin/api-endpoints" className="text-yge-blue-700 hover:underline">/admin/api-endpoints</Link> — public REST surface</li>
              <li><Link href="/admin/feature-flags" className="text-yge-blue-700 hover:underline">/admin/feature-flags</Link> — roadmap flags</li>
              <li><Link href="/admin/scheduled-tasks" className="text-yge-blue-700 hover:underline">/admin/scheduled-tasks</Link> — planned background jobs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Anywhere</h2>
            <ul className="ml-6 list-disc text-sm text-gray-700">
              <li><Link href="/admin/quick-links" className="text-yge-blue-700 hover:underline">/admin/quick-links</Link> — flat directory of every admin tool</li>
              <li><Link href="/sitemap" className="text-yge-blue-700 hover:underline">/sitemap</Link> — the comprehensive page index</li>
              <li><Link href="/help" className="text-yge-blue-700 hover:underline">/help</Link> + <Link href="/help/glossary" className="text-yge-blue-700 hover:underline">/help/glossary</Link></li>
            </ul>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
