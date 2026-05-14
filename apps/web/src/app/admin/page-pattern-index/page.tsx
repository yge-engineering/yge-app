import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Pattern { name: string; description: string; index: string }

const PATTERNS: Pattern[] = [
  { name: 'by-X grouping', description: 'Count-table per group, e.g. status / state / kind.', index: '/admin/all-by-pages' },
  { name: '-stats panel', description: 'Count + share + view-link panel.', index: '/admin/all-stats-pages' },
  { name: '-detail expandable', description: 'Expandable per-bucket record list.', index: '/admin/all-detail-pages' },
  { name: 'missing-X cleanup', description: 'Records missing a critical field.', index: '/admin/all-missing-pages' },
  { name: 'with-X coverage', description: 'Records that have the field set.', index: '/admin/all-with-pages' },
  { name: 'recent-X / today / this-X', description: 'Time-window filters.', index: '/admin/all-time-window-pages' },
  { name: 'recent last-25 lists', description: 'Per-entity last-25 records.', index: '/admin/all-recent-pages' },
];

export default function PagePatternIndexPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Page patterns" subtitle="Recognize a page by its URL pattern. Each row links to a flat list of that pattern's URLs." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Pattern</th>
                <th className="px-3 py-2">What you get</th>
                <th className="px-3 py-2">Index</th>
              </tr>
            </thead>
            <tbody>
              {PATTERNS.map((p) => (
                <tr key={p.name} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold">{p.name}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{p.description}</td>
                  <td className="px-3 py-2"><Link href={p.index} className="text-xs text-yge-blue-700 hover:underline">{p.index}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
