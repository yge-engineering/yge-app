import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const URLS: string[] = [
  '/admin', '/admin/admin-pages-index', '/admin/all-by-pages', '/admin/all-detail-pages', '/admin/all-detail-views', '/admin/all-missing-pages',
  '/admin/all-recent-pages', '/admin/all-stats-pages', '/admin/all-time-window-pages', '/admin/all-with-pages', '/admin/anchor-pages',
  '/admin/api-endpoints', '/admin/api-roster', '/admin/api-test', '/admin/audit-log-preview', '/admin/audit-recent', '/admin/bond-capacity',
  '/admin/build-info', '/admin/build-info-extended', '/admin/cheatsheet', '/admin/checklists', '/admin/cleanup-index', '/admin/cleanup-progress',
  '/admin/company-info', '/admin/composers', '/admin/coverage-grid', '/admin/coverage-summary', '/admin/cron-list', '/admin/cross-tabs-index',
  '/admin/csv-exports', '/admin/csv-imports', '/admin/dashboards-roster', '/admin/data-health', '/admin/data-overview', '/admin/data-overview-detail',
  '/admin/data-quality', '/admin/data-quality-counts', '/admin/data-quality-grade', '/admin/data-quality-hub', '/admin/data-shapes',
  '/admin/data-status', '/admin/data-summary', '/admin/detail-pages-index', '/admin/dq-pairs', '/admin/empty-tables', '/admin/entity-roster',
  '/admin/everything', '/admin/everything-v2', '/admin/excel-import', '/admin/feature-flags', '/admin/feature-overview', '/admin/file-conventions',
  '/admin/glossary', '/admin/glossary-extended', '/admin/grand-index', '/admin/gusto', '/admin/health', '/admin/health-check', '/admin/health-extended',
  '/admin/help', '/admin/help-pages-index', '/admin/import-export-roster', '/admin/index-of-indexes', '/admin/integrations', '/admin/inverses-hub',
  '/admin/inverses-hub-v2', '/admin/landing', '/admin/landing-v2', '/admin/largest-tables', '/admin/master-data-cards', '/admin/master-index',
  '/admin/milestones', '/admin/missing-pages-index', '/admin/onboarding', '/admin/onboarding-percent', '/admin/onboarding-status',
  '/admin/outcome-snapshot', '/admin/page-count', '/admin/page-pattern-index', '/admin/permissions-roster', '/admin/pipeline-snapshot',
  '/admin/portal-users', '/admin/print-friendly', '/admin/quick-links', '/admin/quick-look', '/admin/recent-activity', '/admin/recent-pages-index',
  '/admin/release-history', '/admin/release-notes', '/admin/role-guide', '/admin/runbook', '/admin/scheduled-tasks', '/admin/section-index',
  '/admin/server-time', '/admin/setup-wizard', '/admin/snapshots-index', '/admin/spec', '/admin/stack-info', '/admin/stats-and-detail-pairs',
  '/admin/stats-pages-index', '/admin/system-info', '/admin/system-pages-index', '/admin/system-status', '/admin/three-up', '/admin/totals',
  '/admin/url-map', '/admin/url-prefix-counts', '/admin/url-prefixes', '/admin/whoami', '/admin/with-pages-index', '/admin/yge-context',
];

export default function AdminPagesIndexPage() {
  requirePermission('audit:view');
  const sorted = [...new Set(URLS)].sort();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Admin pages index" subtitle={`Every page under /admin (${sorted.length}), alphabetical.`} />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
          {sorted.map((href) => (
            <li key={href} className="px-3 py-1.5">
              <Link href={href} className="font-mono text-xs text-yge-blue-700 hover:underline">{href}</Link>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
