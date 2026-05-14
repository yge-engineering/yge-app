import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface ToolLink {
  href: string;
  title: string;
  description: string;
  group: string;
}

const TOOLS: ToolLink[] = [
  { href: '/admin', title: 'Admin home', description: 'Top-level admin landing page.', group: 'Admin' },
  { href: '/admin/company-info', title: 'Company info', description: 'Edit core YGE master profile fields.', group: 'Admin' },
  { href: '/admin/api-tour', title: 'API tour', description: 'Curated overview of API endpoints.', group: 'Admin' },
  { href: '/admin/system-status', title: 'System status', description: 'Live service health snapshot.', group: 'Admin' },
  { href: '/admin/health', title: 'Health check', description: 'Raw /api/admin/health response.', group: 'Admin' },
  { href: '/admin/data-status', title: 'Data status', description: 'Record counts per entity.', group: 'Data' },
  { href: '/admin/data-health', title: 'Data health', description: 'Sanity-check rule failures.', group: 'Data' },
  { href: '/admin/csv-imports', title: 'CSV imports hub', description: 'Bulk import customers, vendors, materials…', group: 'Data' },
  { href: '/admin/csv-exports', title: 'CSV exports hub', description: 'One-click export master data tables.', group: 'Data' },
  { href: '/admin/excel-import', title: 'Excel master import', description: 'Bring in legacy Excel rate sheets.', group: 'Data' },
  { href: '/admin/bond-capacity', title: 'Bond capacity (preview)', description: 'Planned single-job + aggregate bond limits.', group: 'Finance' },
  { href: '/admin/gusto', title: 'Gusto status', description: 'Payroll integration state.', group: 'Finance' },
  { href: '/admin/p2e-accuracy', title: 'P2E accuracy', description: 'Plans-to-Estimate AI accuracy tracking.', group: 'AI' },
  { href: '/admin/onboarding', title: 'Onboarding checklist', description: 'Setup steps for a new company.', group: 'Setup' },
  { href: '/admin/portal-users', title: 'Portal users', description: 'External agency / sub / bond-agent access.', group: 'Setup' },
  { href: '/admin/errors', title: 'Errors log', description: 'Recent server-side errors.', group: 'Diagnostics' },
];

export default function AdminQuickLinksPage() {
  requirePermission('audit:view');
  const groups: Record<string, ToolLink[]> = {};
  for (const t of TOOLS) {
    if (!groups[t.group]) groups[t.group] = [];
    groups[t.group]!.push(t);
  }
  const groupOrder = Object.keys(groups);

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="Admin quick links"
          subtitle="A flat directory of every admin tool — bookmark this for one-click access."
        />
        <div className="space-y-6">
          {groupOrder.map((g) => (
            <section key={g}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{g}</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
                {(groups[g] ?? []).map((t) => (
                  <li key={t.href} className="px-4 py-3">
                    <Link href={t.href} className="text-sm font-semibold text-yge-blue-700 hover:underline">
                      {t.title}
                    </Link>
                    <div className="text-xs text-gray-600">{t.description}</div>
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
