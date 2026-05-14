import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Prefix { prefix: string; description: string; sample: string }

const PREFIXES: Prefix[] = [
  { prefix: '/', description: 'Home / dashboard root.', sample: '/' },
  { prefix: '/at-a-glance', description: 'Single-page command center.', sample: '/at-a-glance' },
  { prefix: '/portfolio', description: 'VP-level overview.', sample: '/portfolio' },
  { prefix: '/dashboard/*', description: 'Mini-dashboard panels for periods.', sample: '/dashboard/morning-briefing' },
  { prefix: '/jobs/*', description: 'Job pipeline + filters + reports + details.', sample: '/jobs/by-status' },
  { prefix: '/bid-results/*', description: 'Bid tabulation outcomes + analytics.', sample: '/bid-results/wins' },
  { prefix: '/customers/*', description: 'Customer master + filters + reports.', sample: '/customers/by-kind' },
  { prefix: '/vendors/*', description: 'Vendor master + filters + reports.', sample: '/vendors/scorecard' },
  { prefix: '/employees/*', description: 'Staff roster + reports.', sample: '/employees/by-status' },
  { prefix: '/materials/*', description: 'Materials master + filters.', sample: '/materials/by-category' },
  { prefix: '/equipment-rates/*', description: 'Owned + rental rate book.', sample: '/equipment-rates/owned-vs-rental' },
  { prefix: '/labor-rates/*', description: 'PW + Private labor rates.', sample: '/labor-rates/by-classification' },
  { prefix: '/cost-codes/*', description: 'Reusable cost code library.', sample: '/cost-codes/by-prefix' },
  { prefix: '/imported-estimates/*', description: 'Estimate workbooks.', sample: '/imported-estimates/by-rate-type' },
  { prefix: '/daily-reports/*', description: 'Field daily reports.', sample: '/daily-reports' },
  { prefix: '/admin/*', description: 'System + master-data admin tools.', sample: '/admin/quick-links' },
  { prefix: '/help/*', description: 'FAQ + glossary + cheatsheet.', sample: '/help' },
  { prefix: '/reports', description: 'Every grouping report by area.', sample: '/reports' },
  { prefix: '/quick-tools', description: 'Every analytic + utility page.', sample: '/quick-tools' },
  { prefix: '/sitemap', description: 'Comprehensive page index.', sample: '/sitemap' },
  { prefix: '/search', description: 'Cross-entity search.', sample: '/search' },
  { prefix: '/favorites', description: 'Local-storage bookmarks.', sample: '/favorites' },
  { prefix: '/feedback', description: 'Mailto:feedback composer.', sample: '/feedback' },
  { prefix: '/changelog', description: 'Static changelog of recent ships.', sample: '/changelog' },
  { prefix: '/about', description: 'Public-facing company info.', sample: '/about' },
  { prefix: '/keyboard-shortcuts', description: 'Keyboard reference.', sample: '/keyboard-shortcuts' },
];

export default function UrlPrefixesPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="URL prefix map" subtitle={`${PREFIXES.length} top-level URL prefixes — what lives under each.`} />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Prefix</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Sample link</th>
              </tr>
            </thead>
            <tbody>
              {PREFIXES.map((p) => (
                <tr key={p.prefix} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs font-semibold">{p.prefix}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{p.description}</td>
                  <td className="px-3 py-2"><Link href={p.sample} className="text-xs text-yge-blue-700 hover:underline">{p.sample}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
