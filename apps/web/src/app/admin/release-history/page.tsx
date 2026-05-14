import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Release { date: string; highlights: string[] }

const RELEASES: Release[] = [
  {
    date: '2026-05-14',
    highlights: [
      '/at-a-glance command center landing page',
      'Time-window filters across every entity (today / this-week / this-month / this-quarter / this-year)',
      'Status filter pages for jobs (prospect / pursuing / bid-submitted / awarded / closed / lost / no-bid / archived)',
      'Outcome filter pages for bid results (wins / losses / TBD / no-award) + leaderboards (biggest wins / closest misses / apparent lows / top competitors)',
      'Data-quality hub + per-field missing-* views across customers / vendors / jobs / employees',
      '/portfolio, /sitemap, /quick-tools, /dashboard/all index pages',
    ],
  },
  {
    date: '2026-05-13',
    highlights: [
      'Bid result CSV import (with dry-run + per-row error reporting)',
      'Imported daily reports CSV import',
      'Bond capacity preview placeholder',
      'Customer newsletter composer (mailto: BCC)',
    ],
  },
  {
    date: '2026-04',
    highlights: [
      'Bid result CRUD + competitor tracking',
      'Vendor scorecard + COI aging report',
      'Equipment rates owned + rental rate book',
      'Master rate Excel import',
    ],
  },
];

export default function ReleaseHistoryPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Release history" subtitle="Timeline of recent shipped features. Newest first." />
        <div className="space-y-6">
          {RELEASES.map((r) => (
            <section key={r.date}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{r.date}</h2>
              <ul className="space-y-1 rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm">
                {r.highlights.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-yge-blue-600">·</span>
                    <span>{h}</span>
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
