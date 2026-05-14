import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Role { name: string; description: string; capabilities: string[] }

const ROLES: Role[] = [
  {
    name: 'Owner (Ryan, Brook)',
    description: 'Full access to everything — sees jobs, bids, financials, payroll, audit, master data.',
    capabilities: ['jobs:viewAll', 'estimates:editAll', 'financials:editAll', 'audit:view', 'admin:full'],
  },
  {
    name: 'Estimator',
    description: 'Creates and edits estimates, records bid results, manages cost-code library.',
    capabilities: ['estimates:viewAll', 'estimates:editAll', 'jobs:viewAll', 'bidResults:editAll'],
  },
  {
    name: 'Office staff (bookkeeping)',
    description: 'AP/AR, payroll, document management. Sees customer + vendor masters.',
    capabilities: ['financials:viewAll', 'customers:editAll', 'vendors:editAll'],
  },
  {
    name: 'Foreman',
    description: 'Daily reports, timecards for own crew, materials orders, photos.',
    capabilities: ['dailyReports:editOwn', 'employees:viewCrew', 'photos:upload'],
  },
  {
    name: 'Field crew',
    description: 'Clock in/out, PTO requests, training certs, pay portal — only own records.',
    capabilities: ['employees:viewSelf', 'timecards:editSelf', 'pto:editSelf'],
  },
  {
    name: 'Portal — agency owner',
    description: 'External read-only access to project progress for owner agencies.',
    capabilities: ['projects:viewOwn'],
  },
  {
    name: 'Portal — subcontractor',
    description: 'External read-only access to POs + lien waivers for own subs.',
    capabilities: ['pos:viewOwn', 'lienWaivers:viewOwn'],
  },
  {
    name: 'Portal — bond agent',
    description: 'External read-only access to bond capacity + project list.',
    capabilities: ['bondCapacity:view'],
  },
];

export default function RoleGuidePage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Role guide" subtitle="Read-only description of the roles the app will support. Auth not wired yet — this is the spec." />
        <div className="space-y-3">
          {ROLES.map((r) => (
            <section key={r.name} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{r.name}</h2>
              <p className="mt-1 text-xs text-gray-700">{r.description}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {r.capabilities.map((c) => (
                  <li key={c} className="rounded bg-yge-blue-50 px-2 py-0.5 font-mono text-[10px] text-yge-blue-700">{c}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
