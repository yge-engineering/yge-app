// /go-live — tenant data readiness checklist for app.youngge.com cutover.
//
// Companion to /api-status (infrastructure). This page answers
// "is YGE's tenant data populated enough to run a real bid?"
// Walks the 9-check tenant readiness helper, renders each row
// with status + remediation + deep-link.
//
// Server component. Fetches the counts from the API summary
// endpoints (estimates, drafts, customers) and the static
// company-info seeds (master profile, bonding, insurance) and
// runs them through runTenantReadiness.

import Link from 'next/link';

import { AppShell, PageHeader } from '../../components';
import { MasterProfileExpiriesTile } from '../../components/master-profile-expiries-tile';
import {
  YGE_BONDING_PROFILE,
  YGE_INSURANCE_PROFILE,
  runTenantReadiness,
  type TenantReadinessInputs,
  type TenantReadinessStatus,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchCount(path: string): Promise<number> {
  try {
    const res = await fetch(`${apiBaseUrl()}${path}`, { cache: 'no-store' });
    if (!res.ok) return 0;
    const json = (await res.json()) as Record<string, unknown>;
    // Best-effort: each summary endpoint returns its rows under a
    // predictable key. Sum any array we find.
    for (const v of Object.values(json)) {
      if (Array.isArray(v)) return v.length;
    }
    return 0;
  } catch {
    return 0;
  }
}

const STATUS_STYLE: Record<TenantReadinessStatus, { label: string; cls: string }> = {
  ready: { label: 'Ready', cls: 'bg-green-100 text-green-800 border-green-300' },
  partial: { label: 'Partial', cls: 'bg-yellow-100 text-yellow-900 border-yellow-300' },
  missing: { label: 'Missing', cls: 'bg-red-100 text-red-900 border-red-300' },
};

export default async function GoLivePage() {
  // Fetch what we can from the API. Missing endpoints fall back
  // to 0 so the check fires "missing" instead of crashing.
  const [estimates, drafts, customers] = await Promise.all([
    fetchCount('/api/priced-estimates'),
    fetchCount('/api/plans-to-estimate/drafts'),
    fetchCount('/api/customers'),
  ]);

  // Rate counts + PDF form review counts come from endpoints
  // that may or may not exist — treat absence as 0.
  const [laborRateCount, equipmentRateCount, materialCount] = await Promise.all([
    fetchCount('/api/rates/labor'),
    fetchCount('/api/rates/equipment'),
    fetchCount('/api/rates/material'),
  ]);

  // PDF form reviewed/total: best-effort via /api/pdf-forms which
  // returns {forms: [...]}. Reviewed count requires walking the
  // list; we estimate by assuming nothing's reviewed yet (the
  // typical state pre-go-live).
  let totalPdfFormCount = 0;
  let reviewedPdfFormCount = 0;
  try {
    const res = await fetch(`${apiBaseUrl()}/api/pdf-forms`, { cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as { forms?: Array<{ reviewed?: boolean }> };
      const forms = json.forms ?? [];
      totalPdfFormCount = forms.length;
      reviewedPdfFormCount = forms.filter((f) => f.reviewed).length;
    }
  } catch {
    // leave as 0
  }

  const inputs: TenantReadinessInputs = {
    hasMasterProfile: false,  // until the DB-backed edit form ships
    hasBondingProfile: YGE_BONDING_PROFILE !== null,
    hasInsuranceProfile: YGE_INSURANCE_PROFILE !== null,
    laborRateCount,
    equipmentRateCount,
    materialCount,
    customerCount: customers,
    estimateCount: estimates,
    draftCount: drafts,
    reviewedPdfFormCount,
    totalPdfFormCount,
  };

  const report = runTenantReadiness(inputs);
  const overall = STATUS_STYLE[report.overallStatus];

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-6 sm:p-8">
        <PageHeader
          title="Go-live readiness"
          subtitle="Tenant data checklist for the app.youngge.com cutover. Different from /api-status (infrastructure health) — these checks are about whether YGE's specific data is populated enough to run a real bid."
        />

        {/* Live expiry warnings from the master profile API.
         *  Separate from the static-seed bonding/insurance check
         *  below because an expired record still passes 'do we
         *  have one on file' but blocks real-bid use. */}
        <MasterProfileExpiriesTile />

        <section className={`mt-4 rounded-lg border p-4 ${overall.cls}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-base font-bold">
              Overall: {overall.label}
            </h2>
            <div className="text-xs font-semibold">
              {report.counts.ready} ready · {report.counts.partial} partial ·{' '}
              {report.counts.missing} missing
            </div>
          </div>
        </section>

        <ul className="mt-6 space-y-3">
          {report.checks.map((c) => {
            const style = STATUS_STYLE[c.status];
            return (
              <li
                key={c.key}
                className={`rounded-lg border bg-white p-4 shadow-sm ${
                  c.status === 'missing'
                    ? 'border-red-200'
                    : c.status === 'partial'
                      ? 'border-yellow-200'
                      : 'border-green-200'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{c.label}</h3>
                  <span
                    className={`whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${style.cls}`}
                  >
                    {style.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-700">{c.detail}</p>
                {c.remediation && (
                  <p className="mt-2 text-xs text-gray-600">
                    <span className="font-semibold">Next step:</span> {c.remediation}
                  </p>
                )}
                {c.fixHref && (
                  <div className="mt-2">
                    <Link
                      href={c.fixHref}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-yge-blue-500 hover:underline"
                      title="Opens in a new tab so the readiness page stays open while you fix"
                    >
                      Fix this in a new tab →
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-8 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          For infrastructure health (DB, Anthropic, Microsoft Graph, AP inbox)
          see{' '}
          <Link href="/api-status" className="text-yge-blue-500 hover:underline">
            /api-status
          </Link>
          . For build SHA + AI prompt version see{' '}
          <Link href="/admin/version" className="text-yge-blue-500 hover:underline">
            /admin/version
          </Link>
          .
        </p>
      </main>
    </AppShell>
  );
}
