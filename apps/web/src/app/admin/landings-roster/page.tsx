import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/at-a-glance', title: 'At a glance', description: 'Command center.' },
  { href: '/portfolio', title: 'Portfolio', description: 'Lifetime + pipeline + masters.' },
  { href: '/dashboard/morning-briefing', title: 'Morning briefing', description: 'Daily wake-up tiles.' },
  { href: '/sitemap', title: 'Site map', description: 'Comprehensive page index.' },
  { href: '/quick-tools', title: 'Quick tools', description: 'Every analytic + utility page.' },
  { href: '/reports', title: 'Reports', description: 'Every grouping report.' },
  { href: '/admin', title: 'Admin home', description: 'Default admin landing.' },
  { href: '/admin/landing', title: 'Admin landing v1', description: 'Minimal entry card grid.' },
  { href: '/admin/landing-v2', title: 'Admin landing v2', description: 'Refreshed entry card grid.' },
  { href: '/admin/anchor-pages', title: 'Anchor pages', description: 'Twelve orientation landings.' },
  { href: '/admin/master-data-cards', title: 'Master data cards', description: 'One card per master table.' },
  { href: '/admin/master-index', title: 'Master index', description: 'Top-level + admin pages by area.' },
  { href: '/admin/grand-index', title: 'Grand index', description: 'Every landing + hub catalog.' },
  { href: '/admin/section-index', title: 'Section index', description: 'Hub-of-hubs listing.' },
  { href: '/admin/index-of-indexes', title: 'Index of indexes', description: 'Meta-meta navigation.' },
  { href: '/admin/quickstart', title: 'Quickstart', description: 'Five-step new-user walkthrough.' },
  { href: '/admin/tour', title: 'Tour', description: 'Guided narrative tour.' },
  { href: '/admin/yge-context', title: 'YGE context', description: 'New-viewer orientation.' },
  { href: '/admin/quick-look', title: 'Quick look', description: 'Plain-English app summary.' },
  { href: '/admin/spec', title: 'Spec', description: 'Engineering one-pager.' },
];

export default function LandingsRosterPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Landings roster" subtitle={`${CARDS.length} landing-style pages in one place.`} />
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
