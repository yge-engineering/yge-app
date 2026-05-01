// /settings — app configuration.
//
// Plain English: where things you'd want to change about how the app
// behaves end up. Most of the actual settings haven't shipped yet —
// this page exists so the link in the sidebar resolves and so we
// have a home for future toggles + integrations.

import { AppShell, Card, LinkButton, PageHeader } from '../../components';
import { isSupabaseConfigured } from '../../lib/auth';

interface Section {
  title: string;
  blurb: string;
  status: 'live' | 'planned';
  items: { label: string; value: string }[];
  actions?: { label: string; href: string }[];
}

export default function SettingsPage() {
  const supabaseLive = isSupabaseConfigured();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const sections: Section[] = [
    {
      title: 'Authentication',
      blurb: 'How users sign in.',
      status: supabaseLive ? 'live' : 'planned',
      items: [
        { label: 'Mode', value: supabaseLive ? 'Supabase Auth' : 'Email allowlist (dev)' },
        { label: 'Allowed users', value: supabaseLive ? '(managed in Supabase)' : 'brookyoung@youngge.com, ryoung@youngge.com' },
        { label: 'Session length', value: '30 days' },
      ],
    },
    {
      title: 'API',
      blurb: 'Where the dashboard fetches data from.',
      status: 'live',
      items: [
        { label: 'NEXT_PUBLIC_API_URL', value: apiBaseUrl },
        { label: 'Health check', value: 'See API status page' },
      ],
      actions: [{ label: 'Open API status', href: '/api-status' }],
    },
    {
      title: 'Brand',
      blurb: 'Logo, letterhead, and company info that prints on every document.',
      status: 'live',
      items: [
        { label: 'Legal name', value: 'Young General Engineering, Inc' },
        { label: 'CSLB', value: '1145219' },
        { label: 'DIR', value: '2000018967' },
      ],
      actions: [{ label: 'Edit brand', href: '/brand' }],
    },
    {
      title: 'Notifications',
      blurb: 'Email + SMS triggers for daily reports, RFI responses, AR aging.',
      status: 'planned',
      items: [
        { label: 'Status', value: 'Not yet wired — every alert is silent for now.' },
      ],
    },
    {
      title: 'Integrations',
      blurb: 'External systems the app talks to.',
      status: 'planned',
      items: [
        { label: 'QuickBooks Online', value: 'Planned for Phase 2' },
        { label: 'DIR rate sync', value: 'Planned for Phase 1 — read https://docs.dir.ca.gov/dlsr/' },
        { label: 'Bluebeam (PDF plan editor)', value: 'Path A — bolt-on per project memory' },
        { label: 'Microsoft Graph (Outlook)', value: 'Planned for Phase 3' },
      ],
    },
    {
      title: 'Data export',
      blurb: 'Pull out your data anytime.',
      status: 'planned',
      items: [
        { label: 'CSV exports', value: 'Available per-list (look for the Export CSV link on AP / AR / customer pages)' },
        { label: 'Full-database export', value: 'On request — email Ryan' },
      ],
    },
  ];

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="Settings"
          subtitle="App configuration. Some sections are placeholders for future settings — they'll fill in as we ship more."
        />

        <div className="space-y-4">
          {sections.map((s) => (
            <Card key={s.title}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{s.title}</h2>
                  <p className="mt-0.5 text-xs text-gray-500">{s.blurb}</p>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    s.status === 'live' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {s.status}
                </span>
              </div>
              <dl className="space-y-1 text-sm">
                {s.items.map((it) => (
                  <div key={it.label} className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-1 last:border-0 last:pb-0">
                    <dt className="text-gray-700">{it.label}</dt>
                    <dd className="truncate text-right text-gray-900">{it.value}</dd>
                  </div>
                ))}
              </dl>
              {s.actions && s.actions.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {s.actions.map((a) => (
                    <LinkButton key={a.href} href={a.href} variant="secondary" size="sm">
                      {a.label}
                    </LinkButton>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
