import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Milestone { bundle: string; description: string; href?: string }

const MILESTONES: Milestone[] = [
  { bundle: '#1929', description: 'Comprehensive site map.', href: '/sitemap' },
  { bundle: '#1932', description: 'VP-level portfolio overview.', href: '/portfolio' },
  { bundle: '#2000', description: 'Single-page command center.', href: '/at-a-glance' },
  { bundle: '#2052', description: 'Flat URL listing of every page.', href: '/admin/everything' },
  { bundle: '#2060', description: 'URL map grouped by area.', href: '/admin/url-map' },
  { bundle: '#2068', description: 'Index of every detail view.', href: '/admin/all-detail-views' },
  { bundle: '#2092', description: 'Stats panel index.', href: '/dashboard/stats-index' },
  { bundle: '#2096', description: 'Cross-tab grid index.', href: '/admin/cross-tabs-index' },
  { bundle: '#2100', description: 'Milestone roster page.', href: '/admin/milestones' },
  { bundle: '#2112', description: 'Grand index — every landing + hub catalog.', href: '/admin/grand-index' },
  { bundle: '#2140', description: 'Index-of-indexes meta page.', href: '/admin/index-of-indexes' },
  { bundle: '#2168', description: 'One-pager spec.', href: '/admin/spec' },
  { bundle: '#2200', description: 'You are here — milestones v2.' },
];

export default function MilestonesV2Page() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Session milestones (v2)" subtitle="Significant pages shipped during the autopilot crank, refreshed at bundle 2200." />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
          {MILESTONES.map((m, i) => (
            <li key={i} className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-baseline md:gap-3">
              <span className="font-mono text-xs text-gray-500 md:w-16">{m.bundle}</span>
              <span className="text-sm text-gray-900 md:flex-1">
                {m.description}
                {m.href ? <> · <Link href={m.href} className="text-yge-blue-700 hover:underline">{m.href}</Link></> : null}
              </span>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
