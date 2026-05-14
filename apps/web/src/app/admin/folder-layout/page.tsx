import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Row { path: string; description: string }

const ROWS: Row[] = [
  { path: 'apps/web/', description: 'Next.js 14 App Router web app.' },
  { path: 'apps/web/src/app/', description: 'Route segments — one folder per URL path.' },
  { path: 'apps/web/src/components/', description: 'Reusable UI components (AppShell, PageHeader, Money, etc.)' },
  { path: 'apps/web/src/lib/', description: 'Web-side helpers (permissions, locale, fetch wrappers).' },
  { path: 'apps/api/', description: 'Node + Express API server.' },
  { path: 'apps/api/src/index.ts', description: 'Express bootstrap. Mounts routes.' },
  { path: 'apps/api/src/routes/', description: 'One file per resource. Each exports a Router.' },
  { path: 'apps/api/src/lib/', description: 'Server-only helpers, including Anthropic + Prisma clients.' },
  { path: 'apps/api/src/middleware/', description: 'Auth, audit, request-id, error handler.' },
  { path: 'packages/shared/', description: 'Shared types + Zod schemas + pure helpers used by both web + api.' },
  { path: 'packages/db/', description: 'Prisma schema, migrations, generated client export.' },
  { path: 'seeds/', description: 'CSV / Excel seed files (some excluded from git).' },
  { path: 'queue/', description: 'Outside the monorepo. Bundle .sh files for the watcher.' },
];

export default function FolderLayoutPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Folder layout" subtitle="Where things live in the YGE monorepo." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Path</th>
                <th className="px-3 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.path} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs">{r.path}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
