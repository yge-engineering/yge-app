import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Row { namespace: string; count: number; description: string }

const ROWS: Row[] = [
  { namespace: '/jobs/by-*', count: 14, description: 'Group-by analytic + cross-tab pages.' },
  { namespace: '/jobs/missing-* and /with-*', count: 10, description: 'Data-quality pairs.' },
  { namespace: '/jobs/this-*', count: 5, description: 'Time-window filters (today/week/month/quarter/year).' },
  { namespace: '/bid-results/by-*', count: 12, description: 'Group-by analytic + cross-tab pages.' },
  { namespace: '/bid-results/wins / losses / etc.', count: 8, description: 'Outcome filters + leaderboards.' },
  { namespace: '/customers/by-*', count: 9, description: 'Group-by analytic pages.' },
  { namespace: '/customers/missing-* and /with-*', count: 8, description: 'Data-quality pairs.' },
  { namespace: '/vendors/by-*', count: 6, description: 'Group-by analytic pages.' },
  { namespace: '/vendors/missing-* and /with-*', count: 8, description: 'Data-quality pairs.' },
  { namespace: '/employees/by-* and /with-*', count: 6, description: 'Roster filters.' },
  { namespace: '/admin/all-*-pages and indexes', count: 12, description: 'Cataloged URL lists.' },
  { namespace: '/admin/*-pages-index', count: 6, description: 'Cards-by-area indexes.' },
  { namespace: '/admin/conventions / glossary / spec / docs', count: 14, description: 'Documentation pages.' },
  { namespace: '/admin/(other)', count: 50, description: 'System / health / roster / hub / snapshot tools.' },
];

export default function UrlNamespaceCountsPage() {
  requirePermission('audit:view');
  const total = ROWS.reduce((s, r) => s + r.count, 0);
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="URL namespace counts" subtitle={`Approximate page count per URL namespace. Total ${total}+ pages.`} />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Namespace</th>
                <th className="px-3 py-2 text-right">Pages</th>
                <th className="px-3 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.namespace} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs">{r.namespace}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.count}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{r.description}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right font-mono">{total}</td>
                <td className="px-3 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
