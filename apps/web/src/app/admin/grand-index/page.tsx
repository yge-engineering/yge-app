import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Section { title: string; items: Array<{ href: string; label: string }> }

const SECTIONS: Section[] = [
  {
    title: 'Top-level landings',
    items: [
      { href: '/at-a-glance', label: 'At a glance — command center' },
      { href: '/portfolio', label: 'Portfolio — VP overview' },
      { href: '/dashboard/morning-briefing', label: 'Morning briefing' },
    ],
  },
  {
    title: 'Indexes',
    items: [
      { href: '/sitemap', label: 'Site map' },
      { href: '/quick-tools', label: 'Quick tools' },
      { href: '/reports', label: 'Reports' },
      { href: '/dashboard/all', label: 'All dashboards' },
      { href: '/admin/everything', label: 'Every page (flat alphabetical)' },
      { href: '/admin/url-map', label: 'URL map (grouped by area)' },
      { href: '/admin/section-index', label: 'Index of indexes' },
      { href: '/admin/grand-index', label: 'Grand index (this page)' },
    ],
  },
  {
    title: 'Analytic hubs',
    items: [
      { href: '/admin/cross-tabs-index', label: 'Cross-tab grids' },
      { href: '/admin/all-detail-views', label: 'All detail views' },
      { href: '/admin/stats-and-detail-pairs', label: 'Stats + detail pairs' },
      { href: '/dashboard/stats-index', label: 'Stats index' },
      { href: '/jobs/statuses', label: 'Job statuses hub' },
      { href: '/bid-results/outcomes', label: 'Bid result outcomes hub' },
    ],
  },
  {
    title: 'Data quality',
    items: [
      { href: '/admin/data-quality-hub', label: 'Data quality hub' },
      { href: '/admin/data-quality-counts', label: 'Data-quality counts' },
      { href: '/admin/cleanup-progress', label: 'Cleanup progress' },
      { href: '/admin/cleanup-index', label: 'Cleanup index' },
      { href: '/admin/inverses-hub', label: 'Inverses hub' },
      { href: '/admin/inverses-hub-v2', label: 'Inverses hub v2' },
      { href: '/admin/data-quality-grade', label: 'Data quality grade' },
    ],
  },
  {
    title: 'Admin tools',
    items: [
      { href: '/admin', label: 'Admin home' },
      { href: '/admin/quick-links', label: 'Admin quick links' },
      { href: '/admin/master-data-cards', label: 'Master data cards' },
      { href: '/admin/data-overview', label: 'Data overview' },
      { href: '/admin/data-overview-detail', label: 'Data overview (detail)' },
      { href: '/admin/csv-imports', label: 'CSV imports' },
      { href: '/admin/csv-exports', label: 'CSV exports' },
      { href: '/admin/integrations', label: 'Integrations' },
      { href: '/admin/feature-overview', label: 'Feature overview' },
      { href: '/admin/feature-flags', label: 'Feature flags' },
      { href: '/admin/scheduled-tasks', label: 'Scheduled tasks' },
      { href: '/admin/cron-list', label: 'Cron list' },
      { href: '/admin/release-history', label: 'Release history' },
      { href: '/admin/milestones', label: 'Session milestones' },
      { href: '/admin/onboarding-status', label: 'Onboarding status' },
      { href: '/admin/setup-wizard', label: 'Setup wizard' },
      { href: '/admin/help', label: 'Admin help' },
      { href: '/admin/cheatsheet', label: 'Admin cheat sheet' },
      { href: '/admin/quick-look', label: 'Quick look (prose)' },
      { href: '/admin/print-friendly', label: 'Print-friendly pages' },
      { href: '/admin/system-info', label: 'System info' },
      { href: '/admin/server-time', label: 'Server time' },
      { href: '/admin/build-info', label: 'Build info' },
      { href: '/admin/health-check', label: 'Health check' },
      { href: '/admin/health-extended', label: 'Health extended' },
      { href: '/admin/api-test', label: 'API test' },
      { href: '/admin/api-endpoints', label: 'API endpoints' },
      { href: '/admin/page-count', label: 'Page count' },
      { href: '/admin/whoami', label: 'Who am I' },
      { href: '/admin/audit-recent', label: 'Audit recent' },
    ],
  },
  {
    title: 'Help & meta',
    items: [
      { href: '/help', label: 'Help / FAQ' },
      { href: '/help/glossary', label: 'Glossary' },
      { href: '/help/getting-started', label: 'Getting started' },
      { href: '/help/cheatsheet', label: 'Help cheat sheet' },
      { href: '/keyboard-shortcuts', label: 'Keyboard shortcuts' },
      { href: '/feedback', label: 'Send feedback' },
      { href: '/favorites', label: 'Favorites' },
      { href: '/about', label: 'About YGE' },
      { href: '/changelog', label: 'Changelog' },
      { href: '/search', label: 'Search' },
    ],
  },
];

export default function GrandIndexPage() {
  requirePermission('audit:view');
  const total = SECTIONS.reduce((s, sec) => s + sec.items.length, 0);
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Grand index" subtitle={`${total} top-level pages organized into ${SECTIONS.length} sections — every landing, hub, dashboard, and admin tool.`} />
        <div className="grid gap-4 md:grid-cols-2">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{s.title}</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
                {s.items.map((it) => (
                  <li key={it.href} className="px-3 py-1.5">
                    <Link href={it.href} className="text-yge-blue-700 hover:underline">{it.label}</Link>
                    <span className="ml-2 font-mono text-[10px] text-gray-400">{it.href}</span>
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
