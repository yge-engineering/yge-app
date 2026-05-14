import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Release { version: string; date: string; added: string[]; changed?: string[]; fixed?: string[] }

const RELEASES: Release[] = [
  {
    version: 'v0.300 (sustaining-engineering crank)',
    date: '2026-05-14',
    added: [
      '/admin/anchor-pages — twelve anchor landings for orientation.',
      '/admin/runbook — collapsible operations procedures.',
      '/admin/url-prefix-counts — pages per URL prefix.',
      '/admin/pipeline-snapshot + /admin/outcome-snapshot — clickable tile grids.',
      '/admin/role-guide + /admin/permissions-roster + /admin/data-shapes — auth + schema specs.',
      '/admin/spec + /admin/glossary — one-pager and term sheet.',
    ],
  },
  {
    version: 'v0.250 (analytic crank)',
    date: '2026-05-14',
    added: [
      '/at-a-glance, /portfolio, /sitemap, /quick-tools, /reports — top-level landings.',
      'Group-by analytic pages across every entity (by-status / by-state / by-kind / by-month / by-year / by-quarter / by-rate-type).',
      '-stats + -detail companion pages.',
      'Cleanup hubs: data-quality, inverses, cleanup-index, cleanup-progress, data-quality-grade.',
      'Time-window filters: today / yesterday / this-week / this-month / this-quarter / this-year.',
    ],
  },
  {
    version: 'v0.150 (CSV + outreach)',
    date: '2026-05-13',
    added: [
      'Bid result CSV import + export with dry-run.',
      'Imported daily reports CSV import.',
      'Customer + vendor newsletter mailto: BCC composers.',
      '/admin/csv-imports + /admin/csv-exports hubs.',
    ],
  },
  {
    version: 'v0.100 (initial public preview)',
    date: '2026-04',
    added: [
      'Estimating module + Excel master rate import.',
      'Bid result CRUD + competitor leaderboard.',
      'Vendor scorecard + COI aging.',
      'Equipment + labor rate book.',
      'Cost-code library.',
    ],
  },
];

export default function ReleaseNotesPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Release notes" subtitle="Versioned summary of recent ships. Newest first." />
        <div className="space-y-4">
          {RELEASES.map((r) => (
            <article key={r.version} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <header className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-gray-900">{r.version}</h2>
                <span className="font-mono text-xs text-gray-500">{r.date}</span>
              </header>
              <section className="mt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Added</h3>
                <ul className="ml-6 list-disc text-sm text-gray-700">
                  {r.added.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </section>
              {r.changed ? (
                <section className="mt-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Changed</h3>
                  <ul className="ml-6 list-disc text-sm text-gray-700">{r.changed.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </section>
              ) : null}
              {r.fixed ? (
                <section className="mt-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fixed</h3>
                  <ul className="ml-6 list-disc text-sm text-gray-700">{r.fixed.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </section>
              ) : null}
            </article>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
