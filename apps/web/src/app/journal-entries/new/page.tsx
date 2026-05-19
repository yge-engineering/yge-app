// /journal-entries/new — hand-key a journal entry.
//
// Plain English: the manual posting form. Pick a date, write a memo,
// add lines (one debit + one credit minimum, more if the entry is
// complex), watch the running balance, save as draft, or post
// straight to the GL.

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { JournalEntryNewForm } from './journal-entry-new-form';

export default function NewJournalEntryPage() {
  requirePermission('financials:edit');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-6">
        <PageHeader
          title="New journal entry"
          subtitle="Hand-keyed posting against the chart of accounts. Debits must equal credits to the cent before you can post."
        />
        <JournalEntryNewForm />
      </main>
    </AppShell>
  );
}
