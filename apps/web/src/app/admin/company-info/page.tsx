import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CompanyInfoCard } from './company-info-card';

export default function CompanyInfoPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader title="Company info" subtitle="Live from /api/company-info." />
        <CompanyInfoCard />
      </main>
    </AppShell>
  );
}
