// /vendors/portal-ready — Sub Portal enablement dashboard.
//
// Office-facing companion to bundles 2740 + 2741 (vendor portal
// fields + editor toggle). Lists every vendor and shows the portal
// state at a glance:
//   - READY    isPortalEnabled=true AND an email resolves
//   - PARTIAL  isPortalEnabled=true but no email captured
//   - OFF      isPortalEnabled=false (default)
//
// Lets office bulk-audit which subs are clear to invite, which
// need an accounting email captured before they can sign in, and
// which haven't been opted in yet. Companion to /vendors/with-coi
// in the office triage workflow.

import Link from 'next/link';

import { AppShell, PageHeader } from '../../../components';
import { PrintButton } from '../../../components/print-button';
import { requirePermission } from '../../../lib/permissions';
import {
  vendorIsPortalReady,
  vendorPortalEmail,
  type Vendor,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface ListResponse { vendors?: Vendor[] }

async function fetchVendors(): Promise<Vendor[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/vendors`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as ListResponse).vendors ?? [];
  } catch {
    return [];
  }
}

type PortalState = 'READY' | 'PARTIAL' | 'OFF';

function portalState(v: Vendor): PortalState {
  if (!v.isPortalEnabled) return 'OFF';
  return vendorIsPortalReady(v) ? 'READY' : 'PARTIAL';
}

export default async function VendorsPortalReadyPage() {
  requirePermission('financials:view');
  const vendors = await fetchVendors();
  const onlySubs = vendors.filter((v) => v.kind === 'SUBCONTRACTOR');
  const rolledUp = {
    ready: onlySubs.filter((v) => portalState(v) === 'READY').length,
    partial: onlySubs.filter((v) => portalState(v) === 'PARTIAL').length,
    off: onlySubs.filter((v) => portalState(v) === 'OFF').length,
  };

  // Sort: READY first (alphabetical), then PARTIAL (alphabetical),
  // then OFF (alphabetical) — so the office can scan the top for
  // who's already live and the bottom for who still needs setup.
  const sorted = [...onlySubs].sort((a, b) => {
    const order: Record<PortalState, number> = { READY: 0, PARTIAL: 1, OFF: 2 };
    const stateDelta = order[portalState(a)] - order[portalState(b)];
    if (stateDelta !== 0) return stateDelta;
    return a.legalName.localeCompare(b.legalName);
  });

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/vendors"
            className="text-sm text-yge-blue-500 hover:underline"
          >
            &larr; All vendors
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/vendors/with-coi"
              className="text-yge-blue-500 hover:underline"
            >
              With current COI →
            </Link>
            <PrintButton label="Print list" />
          </div>
        </div>

        <PageHeader
          title="Sub Portal readiness"
          subtitle="Subs (kind=SUBCONTRACTOR) and their /portal/sub access state. Flip a vendor's Portal enabled checkbox on the vendor detail page to opt them in; capture a Portal email if their primary contact email differs from the accounting inbox."
        />

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <Tile label="Ready to invite" value={String(rolledUp.ready)} tone="ready" />
          <Tile
            label="Enabled, missing email"
            value={String(rolledUp.partial)}
            tone={rolledUp.partial > 0 ? 'warn' : undefined}
          />
          <Tile label="Not yet opted in" value={String(rolledUp.off)} />
        </section>

        {onlySubs.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-700">
            No vendors with kind=SUBCONTRACTOR on file. Add some via{' '}
            <Link href="/vendors" className="text-yge-blue-500 hover:underline">
              /vendors
            </Link>{' '}
            or import from QuickBooks.
          </p>
        ) : (
          <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Sub</th>
                  <th className="px-3 py-2 text-left">CSLB / DIR</th>
                  <th className="px-3 py-2 text-left">Effective email</th>
                  <th className="px-3 py-2 text-left">Portal state</th>
                  <th className="px-3 py-2 text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((v) => {
                  const state = portalState(v);
                  const email = vendorPortalEmail(v);
                  return (
                    <tr key={v.id}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{v.legalName}</div>
                        {v.contactName && (
                          <div className="text-xs text-gray-500">{v.contactName}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {v.cslbLicense ?? '—'}
                        {v.dirRegistration && (
                          <span className="text-gray-500"> · DIR {v.dirRegistration}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {email ? (
                          <code className="font-mono">{email}</code>
                        ) : (
                          <span className="italic text-gray-500">none captured</span>
                        )}
                        {v.portalEmail && (
                          <div className="text-[10px] text-gray-500">
                            (override of {v.email ?? 'primary'})
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatePill state={state} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/vendors/${v.id}`}
                          className="text-xs font-semibold text-yge-blue-500 hover:underline"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        <p className="mt-6 text-xs text-gray-500">
          A sub counts as <strong>READY</strong> when{' '}
          <code className="rounded bg-gray-100 px-1">isPortalEnabled=true</code>{' '}
          and either <code className="rounded bg-gray-100 px-1">portalEmail</code>{' '}
          or the primary contact <code className="rounded bg-gray-100 px-1">email</code>{' '}
          resolves. Magic-link auth + actual invite send arrive in a follow-up
          bundle once email infra (SMTP / Resend) is wired up.
        </p>
      </main>
    </AppShell>
  );
}

function StatePill({ state }: { state: PortalState }) {
  const cls =
    state === 'READY'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : state === 'PARTIAL'
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-gray-100 text-gray-700 border-gray-300';
  const label =
    state === 'READY'
      ? 'Ready'
      : state === 'PARTIAL'
        ? 'Needs email'
        : 'Off';
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ready' | 'warn';
}) {
  const valueCls =
    tone === 'ready'
      ? 'text-emerald-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : 'text-gray-900';
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${valueCls}`}>{value}</div>
    </div>
  );
}
