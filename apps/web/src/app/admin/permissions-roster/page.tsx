import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Perm { key: string; description: string; roles: string }

const PERMS: Perm[] = [
  { key: 'jobs:viewAll', description: 'See every job regardless of who owns it.', roles: 'Owner, Estimator, Office' },
  { key: 'estimates:viewAll', description: 'See every imported estimate.', roles: 'Owner, Estimator' },
  { key: 'estimates:editAll', description: 'Create, edit, delete estimate workbooks and lines.', roles: 'Owner, Estimator' },
  { key: 'estimates:view', description: 'See estimates assigned to you.', roles: 'Foreman' },
  { key: 'bidResults:editAll', description: 'Record + edit bid result tabulations.', roles: 'Owner, Estimator' },
  { key: 'financials:view', description: 'See financial reports + master data lists.', roles: 'Owner, Office' },
  { key: 'financials:viewAll', description: 'See AP, AR, payroll, GL.', roles: 'Owner, Office' },
  { key: 'financials:editAll', description: 'Post journal entries, void invoices.', roles: 'Owner' },
  { key: 'customers:editAll', description: 'Create, edit, soft-delete customer records.', roles: 'Owner, Office' },
  { key: 'vendors:editAll', description: 'Create, edit, soft-delete vendor records.', roles: 'Owner, Office' },
  { key: 'employees:viewSelf', description: 'See only your own employee profile.', roles: 'Field crew' },
  { key: 'employees:viewCrew', description: 'See members of your crew.', roles: 'Foreman' },
  { key: 'dailyReports:editOwn', description: 'Create + edit daily reports you submitted.', roles: 'Foreman' },
  { key: 'audit:view', description: 'See the audit log + admin pages.', roles: 'Owner' },
  { key: 'admin:full', description: 'Full admin access — settings, integrations, deletes.', roles: 'Owner' },
];

export default function PermissionsRosterPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Permissions roster" subtitle="Every permission key the app checks against. Auth is in progress." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Permission key</th>
                <th className="px-3 py-2">What it grants</th>
                <th className="px-3 py-2">Roles</th>
              </tr>
            </thead>
            <tbody>
              {PERMS.map((p) => (
                <tr key={p.key} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs">{p.key}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{p.description}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{p.roles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
