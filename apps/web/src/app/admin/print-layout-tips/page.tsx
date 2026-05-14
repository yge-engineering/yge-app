import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Tip { title: string; body: string }

const TIPS: Tip[] = [
  {
    title: 'Cmd / Ctrl + P prints any page',
    body: 'Tailwind utility classes mostly survive into print; the AppShell sidebar collapses for paginated output.',
  },
  {
    title: 'Best pages for paper',
    body: '/help/cheatsheet, /admin/cheatsheet, /admin/spec, /admin/quickstart, and /about all read well as a single printed sheet.',
  },
  {
    title: 'Avoid printing tile dashboards',
    body: 'Pages like /at-a-glance and /portfolio are screen-oriented; the live tile values are less useful frozen on paper.',
  },
  {
    title: 'CSV export over screenshot',
    body: 'For tabular data, prefer /admin/csv-exports and print the CSV. The screen version paginates awkwardly above ~200 rows.',
  },
  {
    title: 'Print-friendly index',
    body: 'See /admin/print-friendly for pages curated as print-target.',
  },
];

export default function PrintLayoutTipsPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Print layout tips" subtitle="Guide to printing pages from the YGE app." />
        <ul className="space-y-3">
          {TIPS.map((t, i) => (
            <li key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{t.title}</h2>
              <p className="mt-1 text-sm text-gray-700">{t.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          Compare with{' '}
          <Link href="/admin/print-friendly" className="text-yge-blue-700 hover:underline">/admin/print-friendly</Link>.
        </p>
      </main>
    </AppShell>
  );
}
