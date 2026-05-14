import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Row {
  prefix: string;
  stats: boolean;
  detail: boolean;
  recent: boolean;
  windows: boolean;
  missing: boolean;
  withIt: boolean;
  newPage: boolean;
}

const ROWS: Row[] = [
  { prefix: '/jobs', stats: true, detail: true, recent: true, windows: true, missing: true, withIt: true, newPage: true },
  { prefix: '/bid-results', stats: true, detail: true, recent: true, windows: true, missing: false, withIt: false, newPage: true },
  { prefix: '/customers', stats: true, detail: true, recent: true, windows: true, missing: true, withIt: true, newPage: true },
  { prefix: '/vendors', stats: true, detail: true, recent: true, windows: true, missing: true, withIt: true, newPage: true },
  { prefix: '/employees', stats: true, detail: true, recent: true, windows: true, missing: true, withIt: true, newPage: true },
  { prefix: '/materials', stats: true, detail: true, recent: true, windows: false, missing: false, withIt: false, newPage: true },
  { prefix: '/equipment-rates', stats: false, detail: true, recent: true, windows: false, missing: false, withIt: false, newPage: true },
  { prefix: '/labor-rates', stats: true, detail: true, recent: true, windows: false, missing: false, withIt: false, newPage: true },
  { prefix: '/cost-codes', stats: true, detail: true, recent: true, windows: false, missing: false, withIt: false, newPage: true },
  { prefix: '/imported-estimates', stats: false, detail: true, recent: true, windows: true, missing: false, withIt: false, newPage: true },
  { prefix: '/daily-reports', stats: false, detail: false, recent: true, windows: true, missing: false, withIt: false, newPage: false },
];

function cell(b: boolean) { return b ? <span className="text-green-700">✓</span> : <span className="text-gray-300">—</span>; }

export default function UrlCoveragePage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="URL coverage" subtitle="Which page patterns each entity has shipped." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Prefix</th>
                <th className="px-3 py-2 text-center">-stats</th>
                <th className="px-3 py-2 text-center">-detail</th>
                <th className="px-3 py-2 text-center">recent</th>
                <th className="px-3 py-2 text-center">time-window</th>
                <th className="px-3 py-2 text-center">missing-X</th>
                <th className="px-3 py-2 text-center">with-X</th>
                <th className="px-3 py-2 text-center">/new</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.prefix} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs font-semibold">{r.prefix}</td>
                  <td className="px-3 py-2 text-center">{cell(r.stats)}</td>
                  <td className="px-3 py-2 text-center">{cell(r.detail)}</td>
                  <td className="px-3 py-2 text-center">{cell(r.recent)}</td>
                  <td className="px-3 py-2 text-center">{cell(r.windows)}</td>
                  <td className="px-3 py-2 text-center">{cell(r.missing)}</td>
                  <td className="px-3 py-2 text-center">{cell(r.withIt)}</td>
                  <td className="px-3 py-2 text-center">{cell(r.newPage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
