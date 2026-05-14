// /search — top-level search hub linking the four entity searches.

import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';

const TARGETS = [
  { href: '/imported-estimates/search', label: 'Search bids', blurb: 'Project name, client, notes, line items.' },
  { href: '/customers/search', label: 'Search customers', blurb: 'Name, contact, email.' },
  { href: '/vendors/search', label: 'Search vendors / subs', blurb: 'Name, trade, email.' },
  { href: '/cost-codes/search', label: 'Search cost codes', blurb: 'Code prefix, name, category.' },
];

export default function SearchHubPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Search" subtitle="What are you looking for?" />
        <ul className="grid gap-3 sm:grid-cols-2">
          {TARGETS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-yge-blue-300 hover:bg-yge-blue-50"
              >
                <div className="text-sm font-semibold text-yge-blue-900">{t.label}</div>
                <p className="text-xs text-gray-600">{t.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
