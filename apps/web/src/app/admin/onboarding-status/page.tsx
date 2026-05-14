import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { OnboardingStatus } from './status-panel';

export default function OnboardingStatusPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Onboarding status" subtitle="How far through the seven-step setup wizard YGE is." />
        <OnboardingStatus />
        <p className="mt-4 text-xs text-gray-500">
          Setup steps and intent at{' '}
          <Link href="/admin/setup-wizard" className="text-yge-blue-700 hover:underline">/admin/setup-wizard</Link>.
        </p>
      </main>
    </AppShell>
  );
}
