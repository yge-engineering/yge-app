import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/sitemap', title: 'Site map', description: 'Comprehensive page index.' },
  { href: '/admin/everything', title: 'Every page', description: 'Flat alphabetical list of every URL.' },
  { href: '/admin/url-map', title: 'URL map', description: 'URLs grouped by first segment.' },
  { href: '/quick-tools', title: 'Quick tools', description: 'Every analytic + utility page in one list.' },
  { href: '/reports', title: 'Reports', description: 'Every grouping report by area.' },
  { href: '/dashboard/all', title: 'All dashboards', description: 'Every dashboard variant.' },
  { href: '/dashboard/stats-index', title: 'Stats index', description: 'Mini-stats panels for current periods.' },
  { href: '/admin/cross-tabs-index', title: 'Cross-tabs index', description: 'Two-dimensional grids.' },
  { href: '/admin/all-detail-views', title: 'All detail views', description: 'Every expandable group-by page.' },
  { href: '/admin/data-quality-hub', title: 'Data quality hub', description: 'Every missing-X cleanup view.' },
  { href: '/admin/inverses-hub-v2', title: 'Cleanup inverses', description: 'Missing-X vs has-X pairs.' },
  { href: '/admin/cleanup-index', title: 'Cleanup index', description: 'Missing / has / detail per field.' },
  { href: '/admin/quick-links', title: 'Admin quick links', description: 'Flat directory of admin tools.' },
  { href: '/admin/master-data-cards', title: 'Master data cards', description: 'Quick-link cards for master tables.' },
  { href: '/admin/data-overview', title: 'Data overview', description: 'Records + actions per entity.' },
  { href: '/admin/cleanup-progress', title: 'Cleanup progress', description: 'Coverage % per field.' },
  { href: '/admin/data-quality-grade', title: 'Data quality grade', description: 'Single letter grade.' },
  { href: '/admin/stats-and-detail-pairs', title: 'Stats + detail pairs', description: 'Every -stats + its -detail companion.' },
];

export default function SectionIndexPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Index of indexes" subtitle={`${CARDS.length} top-level hub pages, each itself an index.`} />
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href} className="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">{c.title}</div>
              <div className="text-xs text-gray-600">{c.description}</div>
              <div className="mt-1 font-mono text-[10px] text-gray-400">{c.href}</div>
            </Link>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
