import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/at-a-glance', title: 'At a glance', description: 'Open me first — command center.' },
  { href: '/portfolio', title: 'Portfolio', description: 'VP-level overview.' },
  { href: '/dashboard/morning-briefing', title: 'Morning briefing', description: 'Daily wake-up tiles.' },
  { href: '/admin/yge-context', title: 'YGE context', description: 'New-viewer orientation.' },
  { href: '/admin/quick-look', title: 'Quick look', description: 'Plain-English app summary.' },
  { href: '/admin/spec', title: 'Spec', description: 'Engineering one-pager.' },
  { href: '/admin/grand-index', title: 'Grand index', description: 'Every landing + hub.' },
  { href: '/admin/master-index', title: 'Master index', description: 'Top-level + admin pages.' },
  { href: '/sitemap', title: 'Site map', description: 'Comprehensive page index.' },
  { href: '/quick-tools', title: 'Quick tools', description: 'Every analytic + utility page.' },
  { href: '/admin/runbook', title: 'Runbook', description: 'Operations procedures.' },
  { href: '/admin/release-notes', title: 'Release notes', description: 'Versioned ship summary.' },
];

export default function AdminLandingV2Page() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Admin landing v2" subtitle="Curated 12-card entry point — start at At a glance." />
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href} className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">{c.title}</div>
              <div className="text-xs text-gray-600">{c.description}</div>
              <div className="mt-2 font-mono text-[10px] text-gray-400">{c.href}</div>
            </Link>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
