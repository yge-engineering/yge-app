// /admin — quick-jump index of admin tools.

import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';

interface Card { href: string; title: string; blurb: string }

const CARDS: Card[] = [
  { href: '/admin/onboarding', title: 'Onboarding', blurb: '7-step new-instance setup.' },
  { href: '/admin/data-status', title: 'Data status', blurb: 'Row counts per master table.' },
  { href: '/admin/excel-import', title: 'Excel import', blurb: 'Upload the YGE workbook.' },
  { href: '/admin/company-info', title: 'Company info', blurb: 'Legal/contact/license facts.' },
  { href: '/admin/api-tour', title: 'API tour', blurb: '50+ endpoints, grouped.' },
  { href: '/admin/health', title: 'System health', blurb: 'Integrations status.' },
  { href: '/admin/audit-log', title: 'Audit log', blurb: 'Every mutation, who & when.' },
  { href: '/admin/portal-users', title: 'Portal users', blurb: 'Invite + role manage.' },
  { href: '/admin/gusto', title: 'Gusto', blurb: 'Payroll sync.' },
];

export default function AdminLandingPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Admin" subtitle="Tools for keeping YGE healthy + onboarding new people." />
        <ul className="grid gap-3 sm:grid-cols-2">
          {CARDS.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-yge-blue-300 hover:bg-yge-blue-50"
              >
                <div className="text-sm font-semibold text-yge-blue-900">{c.title}</div>
                <p className="text-xs text-gray-600">{c.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
