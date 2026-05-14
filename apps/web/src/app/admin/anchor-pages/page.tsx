import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/at-a-glance', title: 'At a glance', description: 'Command center. Open first.' },
  { href: '/portfolio', title: 'Portfolio', description: 'VP-level overview.' },
  { href: '/dashboard/morning-briefing', title: 'Morning briefing', description: 'Daily wake-up tiles.' },
  { href: '/jobs', title: 'Jobs', description: 'Job master list.' },
  { href: '/bid-results', title: 'Bid results', description: 'Bid tabulations.' },
  { href: '/customers', title: 'Customers', description: 'Customer master.' },
  { href: '/vendors', title: 'Vendors', description: 'Vendor / sub master.' },
  { href: '/admin/grand-index', title: 'Grand index', description: 'Every landing + hub.' },
  { href: '/sitemap', title: 'Site map', description: 'Comprehensive page index.' },
  { href: '/quick-tools', title: 'Quick tools', description: 'Every analytic + utility page.' },
  { href: '/help', title: 'Help', description: 'FAQ + glossary + cheatsheet.' },
  { href: '/admin/onboarding-percent', title: 'Onboarding %', description: 'Setup-wizard progress.' },
];

export default function AnchorPagesPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Anchor pages" subtitle="Twelve landings that orient anyone visiting the app for the first time." />
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
