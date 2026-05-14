import { AppShell, PageHeader } from '../../components';

interface Entry { date: string; bullets: string[] }

const ENTRIES: Entry[] = [
  {
    date: '2026-05',
    bullets: [
      'New: /quick-tools global landing page indexes every analytic + utility view.',
      'New: /admin/csv-imports and /admin/csv-exports hubs link every bulk-data tool.',
      'New: /customers/newsletter and /vendors/newsletter mailto:-BCC composers.',
      'New: dozens of group-by analytic pages — by-status, by-state, by-kind, by-year, by-month.',
      'New: data-quality views (missing email, missing classification, missing owner agency, etc.).',
      'New: data-summary tile dashboard at /admin/data-summary.',
      'New: bid-results biggest wins / closest misses / apparent lows / top competitors leaderboards.',
    ],
  },
  {
    date: '2026-04',
    bullets: [
      'New: bid result CSV import + export with dry-run validation.',
      'New: imported daily reports CSV import.',
      'New: equipment-rates owned + rental rate book with CSV round trip.',
      'New: vendor scorecard and COI aging reports.',
    ],
  },
];

export default function ChangelogPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Changelog" subtitle="What's new in the YGE app, newest first." />

        <div className="space-y-6">
          {ENTRIES.map((e) => (
            <section key={e.date}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{e.date}</h2>
              <ul className="space-y-1 rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm">
                {e.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-yge-blue-600">·</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
