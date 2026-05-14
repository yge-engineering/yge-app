import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { OnboardingPercent } from './percent-panel';

export default function OnboardingPercentPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Onboarding percent" subtitle="One number: percent of the setup-wizard steps satisfied." />
        <OnboardingPercent />
      </main>
    </AppShell>
  );
}
