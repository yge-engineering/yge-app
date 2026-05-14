import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/admin/system-info', title: 'System info', description: 'Build + time + health snapshot.' },
  { href: '/admin/build-info', title: 'Build info', description: 'Vercel env dump.' },
  { href: '/admin/build-info-extended', title: 'Build info extended', description: 'Extended env dump.' },
  { href: '/admin/server-time', title: 'Server time', description: 'Server local time + tz.' },
  { href: '/admin/health-check', title: 'Health check', description: 'Friendly /api/admin/health wrapper.' },
  { href: '/admin/health-extended', title: 'Health extended', description: 'Auto-pings every endpoint.' },
  { href: '/admin/api-endpoints', title: 'API endpoints', description: 'Curated list.' },
  { href: '/admin/api-roster', title: 'API roster', description: 'Grouped endpoint roster.' },
  { href: '/admin/api-test', title: 'API test', description: 'Click to ping every endpoint.' },
  { href: '/admin/whoami', title: 'Who am I', description: 'Identity readout.' },
  { href: '/admin/feature-flags', title: 'Feature flags', description: 'Roadmap flags.' },
  { href: '/admin/feature-overview', title: 'Feature overview', description: 'Per-module status.' },
  { href: '/admin/scheduled-tasks', title: 'Scheduled tasks', description: 'Planned recurring jobs.' },
  { href: '/admin/cron-list', title: 'Cron list', description: 'Cron expressions.' },
  { href: '/admin/integrations', title: 'Integrations', description: 'External systems wired in.' },
  { href: '/admin/audit-recent', title: 'Audit recent', description: 'Recent audit log entries.' },
  { href: '/admin/audit-log-preview', title: 'Audit log preview', description: 'Try the audit log endpoint.' },
  { href: '/admin/release-history', title: 'Release history', description: 'Recent ships.' },
];

export default function SystemPagesIndexPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="System pages index" subtitle={`${CARDS.length} system / health / build / API / audit admin pages.`} />
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href} className="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">{c.title}</div>
              <div className="text-xs text-gray-600">{c.description}</div>
              <div className="mt-1 font-mono text-[10px] text-gray-400">{c.href}</div>
            </Link>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
