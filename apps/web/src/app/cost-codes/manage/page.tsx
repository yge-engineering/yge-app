// /cost-codes/manage — cost-code master CRUD.
//
// Plain English: this is where Ryan adds / edits / retires the
// short codes that everything else in YGE refers to. A labor or
// equipment line on an estimate, a daily report cost entry, a
// rate-table row — all of them join here by `code`.

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CostCodeManager } from './cost-code-manager';

export default function CostCodesManagePage() {
  requirePermission('financials:edit');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-6">
        <PageHeader
          title="Cost codes"
          subtitle="The master list of short codes that estimates, daily reports, and rate tables all join to."
        />
        <CostCodeManager />
      </main>
    </AppShell>
  );
}
