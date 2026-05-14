import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const IMPORTERS = [
  { href: '/customers/import', title: 'Customers', blurb: 'legalName + kind required. Dry-run available.' },
  { href: '/vendors/import', title: 'Vendors / subs', blurb: 'legalName + kind. Trade specialty, license, terms optional.' },
  { href: '/materials/import', title: 'Materials', blurb: 'code + name + unit + unitCost. Re-quote sticky prices.' },
  { href: '/equipment-rates/import', title: 'Equipment rates', blurb: 'OWNED or RENTAL — hourly + daily/weekly/monthly.' },
  { href: '/cost-codes/import', title: 'Cost codes', blurb: 'code + name. Category optional.' },
];

export default function CsvImportsHubPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="CSV imports" subtitle="Bulk-upload master data from spreadsheets." />
        <p className="mb-4 text-xs text-gray-600">
          Every importer supports a dry-run preview before writing to DB, and
          reports per-row errors. Each page also lets you download the current
          dataset as a starter CSV.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {IMPORTERS.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-yge-blue-300 hover:bg-yge-blue-50"
              >
                <div className="text-sm font-semibold text-yge-blue-900">{i.title}</div>
                <p className="text-xs text-gray-600">{i.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
