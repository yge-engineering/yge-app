import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Group { area: string; items: string[] }

const GROUPS: Group[] = [
  { area: 'Top', items: ['/', '/at-a-glance', '/portfolio', '/sitemap', '/quick-tools', '/reports', '/search', '/favorites', '/feedback', '/changelog', '/about', '/keyboard-shortcuts'] },
  { area: 'Dashboard', items: ['/dashboard/all', '/dashboard/morning-briefing', '/dashboard/today', '/dashboard/yesterday', '/dashboard/last-7-days', '/dashboard/this-month', '/dashboard/this-quarter', '/dashboard/stats-index'] },
  { area: 'Help', items: ['/help', '/help/getting-started', '/help/cheatsheet', '/help/glossary'] },
  { area: 'Admin landings', items: ['/admin', '/admin/landing', '/admin/quick-links', '/admin/quick-look', '/admin/yge-context', '/admin/master-data-cards', '/admin/section-index', '/admin/grand-index', '/admin/master-index'] },
  { area: 'Admin data', items: ['/admin/data-overview', '/admin/data-overview-detail', '/admin/data-status', '/admin/data-summary', '/admin/data-health', '/admin/data-quality', '/admin/data-quality-hub', '/admin/data-quality-counts', '/admin/data-quality-grade', '/admin/cleanup-progress', '/admin/cleanup-index', '/admin/inverses-hub', '/admin/inverses-hub-v2', '/admin/empty-tables', '/admin/largest-tables', '/admin/totals'] },
  { area: 'Admin system', items: ['/admin/health-check', '/admin/health-extended', '/admin/system-info', '/admin/server-time', '/admin/build-info', '/admin/build-info-extended', '/admin/api-endpoints', '/admin/api-test', '/admin/audit-recent', '/admin/audit-log-preview', '/admin/feature-flags', '/admin/feature-overview', '/admin/integrations', '/admin/scheduled-tasks', '/admin/cron-list', '/admin/release-history', '/admin/milestones', '/admin/onboarding-status', '/admin/onboarding-percent', '/admin/setup-wizard', '/admin/help', '/admin/cheatsheet', '/admin/print-friendly', '/admin/whoami', '/admin/page-count', '/admin/recent-activity', '/admin/three-up'] },
  { area: 'Admin imports / exports', items: ['/admin/csv-imports', '/admin/csv-exports', '/admin/excel-import'] },
];

export default function MasterIndexPage() {
  requirePermission('audit:view');
  const total = GROUPS.reduce((s, g) => s + g.items.length, 0);
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Master index" subtitle={`${total} top-level + admin pages, grouped by area.`} />
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <section key={g.area}>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{g.area}  ({g.items.length})</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
                {g.items.map((href) => (
                  <li key={href} className="px-3 py-1.5">
                    <Link href={href} className="font-mono text-xs text-yge-blue-700 hover:underline">{href}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
