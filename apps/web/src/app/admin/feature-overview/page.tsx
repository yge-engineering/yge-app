import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Feature { area: string; name: string; status: 'shipped' | 'in-progress' | 'planned' }

const FEATURES: Feature[] = [
  { area: 'Estimating', name: 'Imported estimates list + detail', status: 'shipped' },
  { area: 'Estimating', name: 'Excel master rate import', status: 'shipped' },
  { area: 'Estimating', name: 'Cost code variance tracking', status: 'shipped' },
  { area: 'Estimating', name: 'Plans-to-Estimate AI', status: 'in-progress' },

  { area: 'Bid intel', name: 'Bid result CRUD + competitor tracking', status: 'shipped' },
  { area: 'Bid intel', name: 'Bid result CSV import/export', status: 'shipped' },
  { area: 'Bid intel', name: 'Win-rate + competitor leaderboards', status: 'shipped' },
  { area: 'Bid intel', name: 'Send-awarded-to-§4104 button', status: 'planned' },

  { area: 'Jobs', name: 'Pipeline board + status filters', status: 'shipped' },
  { area: 'Jobs', name: 'Budget vs actual', status: 'shipped' },
  { area: 'Jobs', name: 'Awarded revenue rollup', status: 'shipped' },

  { area: 'Contacts', name: 'Customer + vendor masters', status: 'shipped' },
  { area: 'Contacts', name: 'COI aging + vendor scorecard', status: 'shipped' },
  { area: 'Contacts', name: 'Newsletter composer (mailto: BCC)', status: 'shipped' },

  { area: 'Master data', name: 'Material + equipment + labor rates', status: 'shipped' },
  { area: 'Master data', name: 'Cost-code library', status: 'shipped' },
  { area: 'Master data', name: 'CSV import/export hub', status: 'shipped' },

  { area: 'Admin', name: 'Data health + data status', status: 'shipped' },
  { area: 'Admin', name: 'Audit log', status: 'shipped' },
  { area: 'Admin', name: 'Bond capacity', status: 'planned' },

  { area: 'Mobile', name: 'Mobile-responsive layout pass', status: 'planned' },
  { area: 'Mobile', name: 'Expo native shell', status: 'planned' },
];

export default function FeatureOverviewPage() {
  requirePermission('audit:view');
  const groups: Record<string, Feature[]> = {};
  for (const f of FEATURES) {
    if (!groups[f.area]) groups[f.area] = [];
    groups[f.area]!.push(f);
  }
  const toneFor = (s: Feature['status']) =>
    s === 'shipped' ? 'bg-green-100 text-green-800' :
    s === 'in-progress' ? 'bg-amber-100 text-amber-800' :
    'bg-gray-100 text-gray-700';

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Feature overview" subtitle="Where each major module stands — shipped, in-progress, or still planned." />
        <div className="space-y-6">
          {Object.entries(groups).map(([area, list]) => (
            <section key={area}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{area}</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
                {list.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span className="text-gray-900">{f.name}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneFor(f.status)}`}>
                      {f.status.toUpperCase()}
                    </span>
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
