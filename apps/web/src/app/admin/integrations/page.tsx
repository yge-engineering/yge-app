import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Integration { name: string; status: 'shipped' | 'in-progress' | 'planned'; description: string; href?: string }

const ITEMS: Integration[] = [
  { name: 'Anthropic Claude (server-side)', status: 'shipped', description: 'Plans-to-Estimate + future AI bid letters. Server-only key.' },
  { name: 'Supabase Postgres', status: 'shipped', description: 'Primary database via Prisma.' },
  { name: 'Supabase Storage', status: 'shipped', description: 'Files / documents go through the API.' },
  { name: 'Supabase Auth', status: 'in-progress', description: 'Email + OAuth + WebAuthn biometric login.' },
  { name: 'Gusto payroll', status: 'in-progress', description: 'Status at /admin/gusto.', href: '/admin/gusto' },
  { name: 'QuickBooks Online', status: 'planned', description: 'Replace QuickBooks Online as the source of truth.' },
  { name: 'Caltrans / DIR / CSLB form submission', status: 'planned', description: 'Auto-fill + e-sign for agency forms.' },
  { name: 'Bond agent portal', status: 'planned', description: 'Read-only capacity + project list for bonding company.' },
  { name: 'Email parsing', status: 'planned', description: 'Inbound inbox to convert bids and RFIs into records.' },
  { name: 'Mobile (Expo)', status: 'planned', description: 'React Native shell sharing the shared package.' },
];

const TONE: Record<Integration['status'], string> = {
  shipped: 'bg-green-100 text-green-800',
  'in-progress': 'bg-amber-100 text-amber-800',
  planned: 'bg-gray-200 text-gray-700',
};

export default function IntegrationsPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Integrations" subtitle="External systems wired in (or planned) — read-only roadmap." />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
          {ITEMS.map((i) => (
            <li key={i.name} className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-baseline md:gap-3">
              <span className="font-semibold text-gray-900 md:w-1/3">{i.name}</span>
              <span className="text-xs text-gray-600 md:flex-1">
                {i.description}
                {i.href ? <> · <Link href={i.href} className="text-yge-blue-700 hover:underline">{i.href}</Link></> : null}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${TONE[i.status]}`}>
                {i.status}
              </span>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
