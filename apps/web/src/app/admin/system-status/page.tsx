// /admin/system-status — DB / Anthropic / Microsoft / AP-poll status.
//
// Plain English: hits the API's /health/integrations roll-up and
// renders each subsystem's status as a tile. Owners get a one-glance
// view of what's up and what's degraded so they can call the right
// vendor when something breaks.

import { AppShell, Card, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface SubsystemStatus {
  status?: 'ok' | 'degraded';
  reason?: string;
  [k: string]: unknown;
}
interface HealthResponse {
  at?: string;
  db?: SubsystemStatus;
  anthropic?: SubsystemStatus;
  microsoft?: SubsystemStatus;
  apInbox?: SubsystemStatus;
}

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/health/integrations`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as HealthResponse;
  } catch {
    return null;
  }
}

export default async function SystemStatusPage() {
  requirePermission('audit:view');
  const health = await fetchHealth();

  if (!health) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl">
          <PageHeader
            title="System status"
            subtitle="Pulled from /health/integrations on the API."
          />
          <Card>
            <p className="text-sm text-red-700">
              ⚠ Couldn't reach the API. Check that yge-api on Render is up
              and that NEXT_PUBLIC_API_URL is set on Vercel.
            </p>
          </Card>
        </main>
      </AppShell>
    );
  }

  const subsystems: Array<{
    key: string;
    label: string;
    info: SubsystemStatus | undefined;
  }> = [
    { key: 'db', label: 'Postgres (Supabase)', info: health.db },
    { key: 'anthropic', label: 'Anthropic API key', info: health.anthropic },
    { key: 'microsoft', label: 'Microsoft 365 Graph', info: health.microsoft },
    { key: 'apInbox', label: 'AP inbox auto-poll', info: health.apInbox },
  ];

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="System status"
          subtitle={
            health.at
              ? `Last refreshed ${new Date(health.at).toLocaleString()}`
              : 'Pulled from /health/integrations on the API.'
          }
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {subsystems.map((s) => {
            const status = s.info?.status ?? 'degraded';
            const reason = s.info?.reason;
            const tone =
              status === 'ok'
                ? 'border-green-300 bg-green-50 text-green-900'
                : 'border-amber-300 bg-amber-50 text-amber-900';
            const icon = status === 'ok' ? '✓' : '⚠';
            return (
              <div key={s.key} className={`rounded-lg border p-4 ${tone}`}>
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">{s.label}</h3>
                  <span className="font-mono text-xs">{icon} {status}</span>
                </div>
                {reason && (
                  <p className="mt-1 text-xs">{reason}</p>
                )}
                {/* Surface extra fields the API returned (user counts,
                    age in ms, etc.) when the subsystem is healthy. */}
                {status === 'ok' && s.info && (
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {Object.entries(s.info)
                      .filter(([k]) => k !== 'status' && k !== 'reason')
                      .map(([k, v]) => (
                        <li key={k}>
                          <span className="font-mono text-[10px] uppercase text-gray-600">
                            {k}
                          </span>{' '}
                          <span>{String(v)}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <Card className="mt-6">
          <p className="text-xs text-gray-600">
            Source: <code className="rounded bg-gray-100 px-1 font-mono text-[10px]">GET /health/integrations</code>{' '}
            — bundle 879. External monitors (Render, Better Stack) hit the
            same endpoint.
          </p>
        </Card>
      </main>
    </AppShell>
  );
}
