import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Convention { name: string; description: string; example: string }

const CONVENTIONS: Convention[] = [
  {
    name: 'Money is integer cents',
    description: 'All monetary fields are stored as Int cents. No floats anywhere. Conversion happens at the edge (form input, display).',
    example: '$1,234.56  →  amountCents: 123456',
  },
  {
    name: 'Dates are ISO-8601 strings on the wire',
    description: 'Internal Postgres values are DateTime; transport is ISO-8601 strings. Client never trusts client timestamps for anything that matters.',
    example: '2026-05-14T18:35:00.000Z',
  },
  {
    name: 'Strict TypeScript everywhere',
    description: 'No "any" in production code. noUncheckedIndexedAccess on. Use unknown + narrow, or define a real type.',
    example: 'const v: unknown = JSON.parse(s); if (isJob(v)) ...',
  },
  {
    name: 'Shared shapes live in @yge/shared',
    description: 'If web and api both care about the shape, put it in packages/shared. Export the zod schema AND the inferred type.',
    example: 'import { JobSchema, type Job } from "@yge/shared";',
  },
  {
    name: 'Every API input parses through a Zod schema',
    description: 'No req.body access without schema validation. Use safeParse for runtime safety.',
    example: 'const parsed = JobCreateSchema.safeParse(req.body); if (!parsed.success) return res.status(400)...',
  },
  {
    name: 'Audit log on every mutation',
    description: 'Who, what, when, before-state, after-state. Middleware captures this automatically for routes that go through the audit wrapper.',
    example: 'audit({ entity: "job", action: "update", before, after });',
  },
  {
    name: 'Server-only secrets',
    description: 'Anthropic API key, DB connection string, Stripe keys — server-side only. Never NEXT_PUBLIC_*.',
    example: 'process.env.ANTHROPIC_API_KEY  ✅\\nprocess.env.NEXT_PUBLIC_ANTHROPIC_KEY  ❌',
  },
];

export default function FileConventionsPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Engineering conventions" subtitle="Rules of the road for new code in the YGE repo." />
        <div className="space-y-3">
          {CONVENTIONS.map((c, i) => (
            <article key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{c.name}</h2>
              <p className="mt-1 text-sm text-gray-700">{c.description}</p>
              <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 font-mono text-xs text-gray-900">{c.example}</pre>
            </article>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
