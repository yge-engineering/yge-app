import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TodayTable } from './today-table';

export default function EstimatesTodayPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Imported estimates touched today" subtitle="Workbooks with updatedAt or createdAt = today." />
        <TodayTable />
      </main>
    </AppShell>
  );
}
