import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Dep { name: string; purpose: string; layer: 'web' | 'api' | 'shared' | 'tooling' }

const DEPS: Dep[] = [
  { name: 'next', purpose: 'App Router web framework.', layer: 'web' },
  { name: 'react / react-dom', purpose: 'UI runtime.', layer: 'web' },
  { name: 'tailwindcss', purpose: 'Utility CSS framework.', layer: 'web' },
  { name: 'express', purpose: 'HTTP routing on the API.', layer: 'api' },
  { name: '@prisma/client', purpose: 'Postgres ORM client.', layer: 'api' },
  { name: 'prisma', purpose: 'Schema + migrations CLI.', layer: 'tooling' },
  { name: 'zod', purpose: 'Runtime input validation, shared schemas.', layer: 'shared' },
  { name: '@anthropic-ai/sdk', purpose: 'Claude API for AI features. Server-only.', layer: 'api' },
  { name: '@supabase/supabase-js', purpose: 'Auth + storage client.', layer: 'web' },
  { name: 'multer', purpose: 'Multipart file uploads on the API.', layer: 'api' },
  { name: 'vitest', purpose: 'Unit + integration testing.', layer: 'tooling' },
  { name: 'playwright', purpose: 'E2E browser tests (gated on CI).', layer: 'tooling' },
  { name: 'typescript', purpose: 'Strict typing across the monorepo.', layer: 'tooling' },
  { name: 'turbo', purpose: 'Monorepo task pipeline.', layer: 'tooling' },
  { name: 'pnpm', purpose: 'Package manager + workspaces.', layer: 'tooling' },
];

const LAYER_TONE: Record<Dep['layer'], string> = {
  web: 'bg-blue-100 text-blue-800',
  api: 'bg-emerald-100 text-emerald-800',
  shared: 'bg-purple-100 text-purple-800',
  tooling: 'bg-amber-100 text-amber-800',
};

export default function DependenciesPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Dependencies" subtitle="Major npm packages the YGE app depends on, what they do, and where they live." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Package</th>
                <th className="px-3 py-2">Layer</th>
                <th className="px-3 py-2">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {DEPS.map((d) => (
                <tr key={d.name} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs font-semibold">{d.name}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${LAYER_TONE[d.layer]}`}>{d.layer}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">{d.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
