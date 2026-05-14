import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MorningBriefingPanels } from './briefing-panels';

export default function MorningBriefingPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Morning briefing" subtitle="Key numbers to glance at before the office gets going." />
        <MorningBriefingPanels />
      </main>
    </AppShell>
  );
}
