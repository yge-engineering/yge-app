import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Table { name: string; description: string; key: string }

const TABLES: Table[] = [
  { name: 'Company', description: 'Multi-tenant root. Every other table has a companyId FK.', key: 'id (cuid)' },
  { name: 'Customer', description: 'Master customer record. Soft-deleted via deletedAt.', key: 'id (cuid), companyId' },
  { name: 'Vendor', description: 'Master vendor / subcontractor record. Stores flexible data: jsonb.', key: 'id (cuid), companyId' },
  { name: 'Employee', description: 'Staff roster.', key: 'id (cuid), companyId' },
  { name: 'Material', description: 'Material catalog.', key: 'id (cuid), companyId' },
  { name: 'EquipmentRate', description: 'Owned equipment rate book.', key: 'id (cuid), companyId, code' },
  { name: 'EquipmentRental', description: 'Rental equipment rate book.', key: 'id (cuid), companyId, code' },
  { name: 'LaborRate', description: 'PW + Private labor rates per classification.', key: 'id (cuid), companyId' },
  { name: 'CostCode', description: 'Reusable line buckets.', key: 'id (cuid), companyId, code' },
  { name: 'Job', description: 'Each project YGE pursues.', key: 'id (cuid), companyId' },
  { name: 'ImportedEstimate', description: 'Estimate workbook. Stores lines as jsonb.', key: 'id (cuid), companyId' },
  { name: 'BidResult', description: 'Bid tabulation per bid open.', key: 'id (cuid), companyId, jobId' },
  { name: 'DailyReport', description: 'Field daily report.', key: 'id (cuid), companyId' },
  { name: 'AuditLog', description: 'Server-side mutation log. Read-only.', key: 'id (cuid), companyId, actorId, at' },
];

export default function DbTablesPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Database tables" subtitle="What lives in each Postgres table." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Table</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Key</th>
              </tr>
            </thead>
            <tbody>
              {TABLES.map((t) => (
                <tr key={t.name} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs font-semibold">{t.name}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{t.description}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-gray-500">{t.key}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
