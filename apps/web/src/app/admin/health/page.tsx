// /admin/health — integration health summary.

import {
  AppShell,
  PageHeader,
  StatusPill,
} from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface IntegrationStatus {
  anthropic: { configured: boolean };
  storage: { configured: boolean };
  microsoft: { configured: boolean };
  gusto: { configured: boolean };
  postgres: {
    ok: boolean;
    error: string | null;
    migrationCount: number;
  };
  observability: { errorsLast24h: number };
  checkedAt: string;
}

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchHealth(): Promise<IntegrationStatus | null> {
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/admin/health/integrations`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as IntegrationStatus;
  } catch {
    return null;
  }
}

export default async function AdminHealthPage() {
  requirePermission('audit:view');
  const health = await fetchHealth();

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="System health"
          subtitle="Status of every external integration. Configured = env vars present; OK = round-trip ping succeeded."
        />

        {!health ? (
          <p className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Health check itself failed — API unreachable. Render service
            may be redeploying.
          </p>
        ) : (
          <>
            <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <HealthCard
                label="Anthropic API"
                ok={health.anthropic.configured}
                detail={
                  health.anthropic.configured
                    ? 'ANTHROPIC_API_KEY set'
                    : 'Set ANTHROPIC_API_KEY in Render'
                }
              />
              <HealthCard
                label="Supabase Storage"
                ok={health.storage.configured}
                detail={
                  health.storage.configured
                    ? 'NEXT_PUBLIC_SUPABASE_URL + service-role key set'
                    : 'Missing Supabase env vars'
                }
              />
              <HealthCard
                label="Microsoft Graph"
                ok={health.microsoft.configured}
                detail={
                  health.microsoft.configured
                    ? 'OAuth client + tenant set'
                    : 'Set MICROSOFT_* env vars'
                }
              />
              <HealthCard
                label="Gusto"
                ok={health.gusto.configured}
                detail={
                  health.gusto.configured
                    ? 'API key + company UUID set'
                    : 'See /admin/gusto for setup steps'
                }
              />
              <HealthCard
                label="Postgres"
                ok={health.postgres.ok}
                tone={health.postgres.ok ? 'success' : 'danger'}
                detail={
                  health.postgres.ok
                    ? `Reachable · ${health.postgres.migrationCount} migrations applied`
                    : health.postgres.error ?? 'Connection failed'
                }
              />
              <HealthCard
                label="API errors (24h)"
                ok={health.observability.errorsLast24h === 0}
                tone={
                  health.observability.errorsLast24h === 0
                    ? 'success'
                    : health.observability.errorsLast24h < 5
                      ? 'warn'
                      : 'danger'
                }
                detail={
                  health.observability.errorsLast24h === 0
                    ? 'No 5xx responses captured in the last 24 hours'
                    : `${health.observability.errorsLast24h} errors — see /admin/errors`
                }
              />
            </section>

            <p className="text-[11px] text-gray-500">
              Last checked {health.checkedAt}. Refresh the page to re-run.
            </p>
          </>
        )}
      </main>
    </AppShell>
  );
}

function HealthCard({
  label,
  ok,
  detail,
  tone,
}: {
  label: string;
  ok: boolean;
  detail: string;
  tone?: 'success' | 'warn' | 'danger' | 'muted';
}) {
  const effective: 'success' | 'warn' | 'danger' | 'muted' =
    tone ?? (ok ? 'success' : 'muted');
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
          {label}
        </span>
        <StatusPill
          label={
            effective === 'success'
              ? 'OK'
              : effective === 'danger'
                ? 'FAIL'
                : effective === 'warn'
                  ? 'WARN'
                  : 'Not configured'
          }
          tone={effective}
        />
      </div>
      <p className="mt-1 text-xs text-gray-600">{detail}</p>
    </div>
  );
}
