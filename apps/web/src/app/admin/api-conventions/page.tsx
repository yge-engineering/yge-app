import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Topic { name: string; description: string; example: string }

const TOPICS: Topic[] = [
  {
    name: 'Path style',
    description: 'All REST routes live under /api/*. Plural noun for collections, /:id for items.',
    example: 'GET /api/customers · GET /api/customers/:id · POST /api/customers',
  },
  {
    name: 'Response shape',
    description: 'Always wrap arrays in a named property. Never return a bare top-level array.',
    example: '{ "customers": [...] } · { "bidResults": [...] } · { "rows": [...] }',
  },
  {
    name: 'Error format',
    description: 'Errors use { "error": string }. Zod validation failures add issues.',
    example: '400 → { "error": "Validation failed", "issues": [...zod issues] }',
  },
  {
    name: 'Input validation',
    description: 'Every POST / PATCH / DELETE input parses through a Zod schema first.',
    example: 'const parsed = JobCreateSchema.safeParse(req.body); if (!parsed.success) return res.status(400)...',
  },
  {
    name: 'Pagination',
    description: 'Most list endpoints return everything. Where needed, ?limit and ?cursor will be added.',
    example: 'GET /api/audit-log?limit=25  (not yet wired)',
  },
  {
    name: 'CSV endpoints',
    description: 'Export endpoints set Content-Type text/csv and Content-Disposition attachment. Import endpoints accept multipart/form-data with ?dryRun=1 for preview.',
    example: 'GET /api/customers/export.csv · POST /api/customers/import-csv?dryRun=1',
  },
  {
    name: 'Auth (future)',
    description: 'Once Supabase Auth ships, every route will require a JWT in Authorization: Bearer <token>. Permission checks happen in middleware via requirePermission().',
    example: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...',
  },
];

export default function ApiConventionsPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="API conventions" subtitle="REST + tRPC conventions used across YGE app endpoints." />
        <div className="space-y-3">
          {TOPICS.map((t, i) => (
            <article key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{t.name}</h2>
              <p className="mt-1 text-sm text-gray-700">{t.description}</p>
              <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 font-mono text-xs text-gray-900">{t.example}</pre>
            </article>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
