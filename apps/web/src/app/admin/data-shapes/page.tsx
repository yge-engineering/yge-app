import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Shape { name: string; fields: string[] }

const SHAPES: Shape[] = [
  { name: 'Customer', fields: ['id', 'legalName', 'dbaName', 'kind', 'contactName', 'email', 'phone', 'billingAddressLine', 'city', 'state', 'zip', 'paymentTerms', 'taxExempt', 'onHold', 'jobsCount', 'createdAt', 'updatedAt'] },
  { name: 'Vendor', fields: ['id', 'legalName', 'kind', 'contactName', 'email', 'phone', 'state', 'data (free-form)', 'createdAt'] },
  { name: 'Employee', fields: ['id', 'firstName', 'lastName', 'classification', 'status', 'hireDate', 'laborCostCode', 'phone', 'email'] },
  { name: 'Material', fields: ['id', 'name', 'category', 'uom', 'createdAt'] },
  { name: 'Equipment rate', fields: ['id', 'code', 'name', 'kind (OWNED/RENTAL)', 'hourlyCents', 'dailyCents', 'weeklyCents', 'monthlyCents', 'vendor'] },
  { name: 'Labor rate', fields: ['id', 'classification', 'description', 'hourlyCents', 'rateType (PW/Private)'] },
  { name: 'Cost code', fields: ['id', 'code (PREFIX-NNNN)', 'description'] },
  { name: 'Job', fields: ['id', 'jobNumber', 'projectName', 'status', 'rateType (PW/Private)', 'ownerAgency', 'location', 'createdAt', 'updatedAt'] },
  { name: 'Imported estimate', fields: ['id', 'jobId', 'jobNumber', 'projectName', 'rateType', 'bidPriceCents', 'lines: [{ costCode, description, quantity, totalCostCents }]'] },
  { name: 'Bid result', fields: ['id', 'jobId', 'bidOpenedAt', 'outcome (WON_BY_YGE/WON_BY_OTHER/NO_AWARD/TBD)', 'bidders: [{ bidderName, amountCents, isYge }]'] },
  { name: 'Daily report', fields: ['id', 'reportDate', 'jobNumber', 'weather', 'lines: [{ costCode, qtyHrs, totalCostCents }]'] },
];

export default function DataShapesPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Data shapes" subtitle="Plain-English field list for every modeled entity." />
        <div className="space-y-3">
          {SHAPES.map((s) => (
            <details key={s.name} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold text-gray-900">{s.name}</summary>
              <ul className="mt-2 space-y-1 text-xs text-gray-700">
                {s.fields.map((f) => (
                  <li key={f} className="font-mono">{f}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
