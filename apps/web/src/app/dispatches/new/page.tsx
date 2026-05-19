// /dispatches/new — create a crew-day dispatch.
//
// Plain English: minimal MVP form. Pick a job, name the foreman,
// pick a date + meet time + location, sketch the scope. Crew +
// equipment editors come in a follow-up — they're list-of-rows
// shapes that need their own affordances.

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { DispatchNewForm } from './dispatch-new-form';

export default function NewDispatchPage() {
  requirePermission('field:editAssigned');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-6">
        <PageHeader
          title="New dispatch"
          subtitle="One crew, one job, one day. You can post it as soon as the scope is set; crew and equipment can be filled in from /dispatches/[id] later."
        />
        <DispatchNewForm />
      </main>
    </AppShell>
  );
}
