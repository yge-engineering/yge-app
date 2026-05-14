import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/customers', title: 'Customers', description: 'Agency owners, primes, private customers.' },
  { href: '/vendors', title: 'Vendors', description: 'Subcontractors + suppliers + service providers.' },
  { href: '/employees', title: 'Employees', description: 'Office, foremen, crew, payroll-ready records.' },
  { href: '/materials', title: 'Materials', description: 'Catalog by category + UoM.' },
  { href: '/equipment-rates', title: 'Equipment rates', description: 'Owned + rental rate book.' },
  { href: '/labor-rates', title: 'Labor rates', description: 'PW + Private labor rates by classification.' },
  { href: '/cost-codes', title: 'Cost codes', description: 'Reusable buckets across estimates and actuals.' },
  { href: '/imported-estimates', title: 'Imported estimates', description: 'Bid workbooks imported / built in app.' },
];

export default function MasterDataCardsPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Master data" subtitle={`${CARDS.length} master tables in one click.`} />
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
