import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { AuditPreview } from './audit-preview';

export default function AuditLogPreviewPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Audit log — preview" subtitle="Quick window into the audit log endpoint if it is wired up." />
        <AuditPreview />
      </main>
    </AppShell>
  );
}
