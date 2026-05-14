import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/admin/setup-wizard', title: 'Setup wizard', description: '7-step onboarding plan.' },
  { href: '/admin/onboarding-status', title: 'Onboarding status', description: 'Live scorecard.' },
  { href: '/admin/onboarding-percent', title: 'Onboarding percent', description: 'One number.' },
  { href: '/admin/feature-overview', title: 'Feature overview', description: 'Per-module shipped status.' },
  { href: '/admin/data-quality-hub', title: 'Data quality hub', description: 'Every cleanup view.' },
  { href: '/admin/cleanup-progress', title: 'Cleanup progress', description: 'Coverage %.' },
  { href: '/admin/data-quality-grade', title: 'Data quality grade', description: 'Single letter.' },
  { href: '/admin/data-quality-counts', title: 'Data quality counts', description: 'Bucket counts.' },
  { href: '/admin/empty-tables', title: 'Empty tables', description: 'Zero-record entities.' },
  { href: '/admin/scheduled-tasks', title: 'Scheduled tasks', description: 'Planned recurring jobs.' },
];

export default function ChecklistsPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Checklists" subtitle="Pages that track progress against a list of items." />
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
