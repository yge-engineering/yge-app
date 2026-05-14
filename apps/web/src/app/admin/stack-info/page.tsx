import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Row { layer: string; technology: string; notes: string }

const ROWS: Row[] = [
  { layer: 'Web app', technology: 'Next.js 14 (App Router)', notes: 'Vercel deploys. Strict TypeScript. Tailwind.' },
  { layer: 'API', technology: 'Node 20 + Express + tRPC where it helps', notes: 'Render auto-deploys. Strict TypeScript.' },
  { layer: 'Database', technology: 'PostgreSQL 16 via Supabase pooler', notes: 'Prisma 5 schema + migrations.' },
  { layer: 'Auth', technology: 'Supabase Auth (in progress)', notes: 'Email/password + OAuth + WebAuthn biometric.' },
  { layer: 'Storage', technology: 'Supabase Storage', notes: 'API proxies all file I/O.' },
  { layer: 'AI', technology: '@anthropic-ai/sdk', notes: 'Server-side only. Prompts in apps/api/src/lib/prompts.' },
  { layer: 'Monorepo', technology: 'pnpm workspaces + Turborepo', notes: 'Shared types in packages/shared.' },
  { layer: 'Tests', technology: 'Vitest', notes: 'Real Postgres via Testcontainers for integration tests.' },
  { layer: 'E2E', technology: 'Playwright (gated on CI)', notes: 'Runs against dev Supabase project.' },
  { layer: 'Mobile (Phase 2)', technology: 'React Native / Expo', notes: 'Shares packages/shared with web + API.' },
];

export default function StackInfoPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Stack info" subtitle="What the YGE app runs on, at every layer." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Layer</th>
                <th className="px-3 py-2">Technology</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.layer} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold">{r.layer}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.technology}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
