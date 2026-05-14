import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Group { area: string; items: Array<{ href: string; label: string }> }

const GROUPS: Group[] = [
  {
    area: 'Orientation',
    items: [
      { href: '/admin/yge-context', label: 'YGE context' },
      { href: '/admin/quick-look', label: 'Quick look' },
      { href: '/admin/spec', label: 'Spec' },
      { href: '/admin/runbook', label: 'Runbook' },
    ],
  },
  {
    area: 'Conventions',
    items: [
      { href: '/admin/file-conventions', label: 'Engineering conventions' },
      { href: '/admin/api-conventions', label: 'API conventions' },
      { href: '/admin/audit-conventions', label: 'Audit conventions' },
      { href: '/admin/test-conventions', label: 'Test conventions' },
      { href: '/admin/style-guide', label: 'UI style guide' },
    ],
  },
  {
    area: 'Architecture',
    items: [
      { href: '/admin/stack-info', label: 'Stack info' },
      { href: '/admin/dependencies', label: 'Dependencies' },
      { href: '/admin/folder-layout', label: 'Folder layout' },
      { href: '/admin/data-flow', label: 'Data flow' },
      { href: '/admin/db-tables', label: 'Database tables' },
      { href: '/admin/data-shapes', label: 'Data shapes' },
      { href: '/admin/build-pipeline', label: 'Build pipeline' },
    ],
  },
  {
    area: 'Permissions + security',
    items: [
      { href: '/admin/role-guide', label: 'Role guide' },
      { href: '/admin/permissions-roster', label: 'Permissions roster' },
      { href: '/admin/security-notes', label: 'Security notes' },
    ],
  },
  {
    area: 'Reference',
    items: [
      { href: '/admin/glossary', label: 'Glossary' },
      { href: '/admin/glossary-extended', label: 'Glossary (extended)' },
      { href: '/admin/known-quirks', label: 'Known quirks' },
      { href: '/admin/api-endpoints', label: 'API endpoints' },
      { href: '/admin/api-roster', label: 'API roster' },
      { href: '/admin/entity-roster', label: 'Entity roster' },
    ],
  },
  {
    area: 'Roadmap',
    items: [
      { href: '/admin/feature-overview', label: 'Feature overview' },
      { href: '/admin/feature-flags', label: 'Feature flags (short)' },
      { href: '/admin/feature-flag-detail', label: 'Feature flag detail' },
      { href: '/admin/scheduled-tasks', label: 'Scheduled tasks' },
      { href: '/admin/cron-list', label: 'Cron list' },
      { href: '/admin/integrations', label: 'Integrations' },
      { href: '/admin/release-history', label: 'Release history' },
      { href: '/admin/release-notes', label: 'Release notes' },
      { href: '/admin/milestones', label: 'Milestones' },
    ],
  },
];

export default function DocsPagesIndexPage() {
  requirePermission('audit:view');
  const total = GROUPS.reduce((s, g) => s + g.items.length, 0);
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Docs pages index" subtitle={`${total} documentation pages indexed by topic.`} />
        <div className="grid gap-4 md:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.area}>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{g.area}</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
                {g.items.map((it) => (
                  <li key={it.href} className="px-3 py-2">
                    <Link href={it.href} className="text-yge-blue-700 hover:underline">{it.label}</Link>
                    <span className="ml-2 font-mono text-[10px] text-gray-400">{it.href}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
