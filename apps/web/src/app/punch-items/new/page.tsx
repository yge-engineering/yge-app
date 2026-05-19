// /punch-items/new — add a closeout walkthrough item.

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { PunchItemNewForm } from './punch-item-new-form';

export default function NewPunchItemPage() {
  requirePermission('field:editAssigned');
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl p-6">
        <PageHeader
          title="New punch item"
          subtitle="A single deficiency to fix before the agency releases final payment."
        />
        <PunchItemNewForm />
      </main>
    </AppShell>
  );
}
