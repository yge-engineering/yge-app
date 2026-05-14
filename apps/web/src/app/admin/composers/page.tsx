import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/customers/newsletter', title: 'Customer newsletter', description: 'Bulk email composer (BCC).' },
  { href: '/vendors/newsletter', title: 'Vendor newsletter', description: 'Bulk vendor email composer.' },
  { href: '/feedback', title: 'Send feedback', description: 'Mailto:ryoung@youngge.com composer.' },
  { href: '/search', title: 'Cross-entity search', description: 'Type to filter customers/vendors/jobs.' },
  { href: '/favorites', title: 'Favorites', description: 'Bookmarks (local storage).' },
  { href: '/admin/api-test', title: 'API test', description: 'Click to ping every endpoint.' },
];

export default function ComposersPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Composers" subtitle="Interactive forms — search, mailto, feedback, favorites." />
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
