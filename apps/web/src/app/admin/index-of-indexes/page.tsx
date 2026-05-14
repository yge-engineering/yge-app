import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/sitemap', title: 'Site map', description: 'Top-level page index by area.' },
  { href: '/admin/everything', title: 'Every page', description: 'Flat alphabetical list of every URL.' },
  { href: '/admin/everything-v2', title: 'Every page v2', description: 'Refreshed flat list including newer pages.' },
  { href: '/admin/url-map', title: 'URL map', description: 'Pages grouped by first path segment.' },
  { href: '/admin/master-index', title: 'Master index', description: 'Top-level + admin pages by area.' },
  { href: '/admin/grand-index', title: 'Grand index', description: 'Every landing + hub + dashboard catalog.' },
  { href: '/admin/section-index', title: 'Section index', description: 'Hub-of-hubs listing.' },
  { href: '/admin/stats-pages-index', title: 'Stats pages index', description: 'Every -stats panel by area.' },
  { href: '/admin/detail-pages-index', title: 'Detail pages index', description: 'Every -detail expandable view.' },
  { href: '/admin/recent-pages-index', title: 'Recent pages index', description: 'Every recent / time-window page.' },
  { href: '/admin/missing-pages-index', title: 'Missing-X index', description: 'Every data-quality cleanup view.' },
  { href: '/admin/with-pages-index', title: 'With-X index', description: 'Every positive-coverage view.' },
  { href: '/admin/all-detail-views', title: 'All detail views', description: 'Companion grid for /detail-pages-index.' },
  { href: '/admin/cross-tabs-index', title: 'Cross-tabs index', description: 'Every 2-D cross-tab grid.' },
  { href: '/admin/inverses-hub-v2', title: 'Cleanup inverses', description: 'Missing-X vs has-X pairs.' },
  { href: '/admin/cleanup-index', title: 'Cleanup index', description: 'Missing / has-it / by-X-detail per field.' },
  { href: '/admin/stats-and-detail-pairs', title: 'Stats + detail pairs', description: 'Pair each -stats with its -detail.' },
  { href: '/dashboard/stats-index', title: 'Stats index', description: 'Mini-stats panels for current periods.' },
  { href: '/dashboard/all', title: 'All dashboards', description: 'Every dashboard variant.' },
  { href: '/quick-tools', title: 'Quick tools', description: 'Every analytic + utility page.' },
  { href: '/reports', title: 'Reports', description: 'Every grouping report.' },
];

export default function IndexOfIndexesPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Index of indexes" subtitle={`${CARDS.length} pages whose job is to index other pages. The meta-meta navigation.`} />
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
