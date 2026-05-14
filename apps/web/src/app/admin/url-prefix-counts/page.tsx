import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Row { prefix: string; count: number; sample: string }

// Hand-curated rough page counts under each prefix as of bundle 2169.
const ROWS: Row[] = [
  { prefix: '/admin', count: 80, sample: '/admin' },
  { prefix: '/jobs', count: 48, sample: '/jobs' },
  { prefix: '/bid-results', count: 36, sample: '/bid-results' },
  { prefix: '/customers', count: 32, sample: '/customers' },
  { prefix: '/vendors', count: 30, sample: '/vendors' },
  { prefix: '/employees', count: 17, sample: '/employees' },
  { prefix: '/dashboard', count: 9, sample: '/dashboard/morning-briefing' },
  { prefix: '/help', count: 4, sample: '/help' },
  { prefix: '/imported-estimates', count: 7, sample: '/imported-estimates' },
  { prefix: '/daily-reports', count: 6, sample: '/daily-reports' },
  { prefix: '/materials', count: 5, sample: '/materials' },
  { prefix: '/equipment-rates', count: 5, sample: '/equipment-rates' },
  { prefix: '/labor-rates', count: 5, sample: '/labor-rates' },
  { prefix: '/cost-codes', count: 5, sample: '/cost-codes' },
  { prefix: '/(other top-level)', count: 13, sample: '/at-a-glance' },
];

export default function UrlPrefixCountsPage() {
  requirePermission('audit:view');
  const total = ROWS.reduce((s, r) => s + r.count, 0);
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="URL prefix counts" subtitle={`Approximate page count per top-level prefix. Total ${total} pages.`} />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Prefix</th>
                <th className="px-3 py-2 text-right">Pages</th>
                <th className="px-3 py-2 text-right">Share</th>
                <th className="px-3 py-2">Sample</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.prefix} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs font-semibold">{r.prefix}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.count}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-500">{((r.count / total) * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2">
                    <Link href={r.sample} className="font-mono text-[10px] text-yge-blue-700 hover:underline">{r.sample}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right font-mono">{total}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-500">100.0%</td>
                <td className="px-3 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
