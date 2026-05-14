import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Topic { title: string; body: string }

const TOPICS: Topic[] = [
  {
    title: 'Every mutation captures who-what-when',
    body: 'POST / PATCH / DELETE on /api/* runs through middleware that records actor, entity, action, before-state, after-state. GETs are not audit-logged.',
  },
  {
    title: 'Authoritative on the server',
    body: 'The audit log row is created server-side, never trusted from the client. Client only gets to suggest the request body.',
  },
  {
    title: 'Soft delete preferred over hard delete',
    body: 'Records get a deletedAt timestamp rather than disappearing. Audit log captures the soft-delete the same way as a normal mutation.',
  },
  {
    title: 'Audit log is read-only',
    body: 'No API endpoint mutates the audit log. Even owners cannot edit history.',
  },
  {
    title: 'PII is minimized',
    body: 'We log entity IDs, not full payloads of sensitive fields. SSNs, bank accounts, etc. never enter the log.',
  },
  {
    title: 'Retention',
    body: 'Indefinite. Audit history is small relative to operational tables and we want full back-look.',
  },
];

export default function AuditConventionsPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Audit conventions" subtitle="What gets audit-logged and why." />
        <ul className="space-y-3">
          {TOPICS.map((t, i) => (
            <li key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{t.title}</h2>
              <p className="mt-1 text-sm text-gray-700">{t.body}</p>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
