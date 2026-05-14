import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Note { title: string; body: string }

const NOTES: Note[] = [
  {
    title: 'No client secrets',
    body: 'Anthropic API key, Stripe key, DB connection string, Supabase service-role key — never sent to the browser. Only NEXT_PUBLIC_* env vars cross the wire.',
  },
  {
    title: 'JWT-based auth (in progress)',
    body: 'Supabase Auth issues a JWT after login. API verifies the token signature server-side on every request.',
  },
  {
    title: 'Permission-gated routes',
    body: 'Every web route + API route guards with requirePermission(). Unknown / expired tokens get 401; insufficient permission gets 403.',
  },
  {
    title: 'Audit log on every mutation',
    body: 'Server-side middleware writes a row to the audit_log table for every POST / PATCH / DELETE — actor, entity, action, before, after.',
  },
  {
    title: 'File scanning',
    body: 'Uploads pass through the API. Future: virus scan before commit to Supabase Storage. No client-direct uploads.',
  },
  {
    title: 'PII boundaries',
    body: 'SSNs, bank accounts, payment tokens never enter the audit log or analytics tables. They live in tightly-scoped rows with owner-only read.',
  },
  {
    title: 'Multi-tenant isolation',
    body: 'Every Postgres table carries companyId. All queries filter on companyId derived from the JWT. Cross-tenant leakage is structurally prevented.',
  },
];

export default function SecurityNotesPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Security notes" subtitle="High-level security posture for the YGE app." />
        <ul className="space-y-3">
          {NOTES.map((n, i) => (
            <li key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{n.title}</h2>
              <p className="mt-1 text-sm text-gray-700">{n.body}</p>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
