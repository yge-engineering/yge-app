'use client';

// /safety-library — version-controlled safety documents.
//
// Wires bundle 2484's safety-doc-version helpers into a viewer.
// Shows each safety document with its full version chain, the
// in-effect version on the as-of date highlighted, and a staleness
// warning for IIPP / heat illness plan when the current version is
// over a year old (Cal/OSHA inspectors expect annual review).
//
// No persisted store yet — the page seeds a handful of typical YGE
// documents at the top so the layout is concrete. A future bundle
// adds a Prisma table + API store + upload UI so real PDFs land
// here and the viewer hooks them up.

import { useMemo, useState } from 'react';
import {
  currentVersionAt,
  historicalChain,
  pendingChanges,
  staleByDays,
  type SafetyDocument,
  type SafetyDocumentVersion,
} from '@yge/shared';

import { AppShell, PageHeader } from '../../components';

const SEED_DOCS: SafetyDocument[] = [
  { id: 'iipp', kind: 'IIPP', title: 'YGE Cottonwood Yard IIPP', jurisdiction: 'CA' },
  { id: 'heat', kind: 'HEAT_ILLNESS_PLAN', title: 'Heat illness prevention plan', jurisdiction: 'CA' },
  { id: 'hazcomm', kind: 'HAZ_COMM_PROGRAM', title: 'Hazard communication program', jurisdiction: 'CA' },
  { id: 'loto', kind: 'CONTROL_OF_HAZ_ENERGY_LOTO', title: 'Lockout/tagout program', jurisdiction: 'CA' },
  { id: 'sds-rotella', kind: 'SDS', title: 'Shell Rotella T6 5W-40', jurisdiction: 'BOTH', productIdentifier: 'Rotella T6' },
];

const SEED_VERSIONS: SafetyDocumentVersion[] = [
  { id: 'iipp-v1', documentId: 'iipp', versionLabel: 'v1', effectiveOn: '2024-01-01', supersededOn: '2025-04-01', summary: 'Initial release.' },
  { id: 'iipp-v2', documentId: 'iipp', versionLabel: 'v2 (annual review)', effectiveOn: '2025-04-01', summary: 'Annual review update; added confined-space cross-ref to LOTO program.' },
  { id: 'heat-v1', documentId: 'heat', versionLabel: 'v1', effectiveOn: '2024-05-15', supersededOn: '2025-05-15', summary: '2024 season.' },
  { id: 'heat-v2', documentId: 'heat', versionLabel: 'v2 (2025)', effectiveOn: '2025-05-15', supersededOn: '2026-05-01', summary: 'Updated cool-down rest spec for >100°F.' },
  { id: 'heat-v3', documentId: 'heat', versionLabel: 'v3 (2026)', effectiveOn: '2026-05-01', summary: 'Refreshed for 2026 season; added evening-shift protocol.' },
  { id: 'hazcomm-v1', documentId: 'hazcomm', versionLabel: 'v1', effectiveOn: '2024-03-01', summary: 'Initial release.' },
  { id: 'loto-v1', documentId: 'loto', versionLabel: 'v1', effectiveOn: '2025-06-01', summary: 'Initial release.' },
  { id: 'sds-rotella-v1', documentId: 'sds-rotella', versionLabel: 'Rev 2024-09', effectiveOn: '2024-09-15', supersededOn: '2026-02-01', summary: 'Manufacturer routine revision.' },
  { id: 'sds-rotella-v2', documentId: 'sds-rotella', versionLabel: 'Rev 2026-02', effectiveOn: '2026-02-01', summary: 'Reclassified Cat 3 / oral (LD50 update).' },
];

const STALE_THRESHOLD_DAYS = 365;
const PENDING_WINDOW_DAYS = 60;

const KIND_LABEL: Record<SafetyDocument['kind'], string> = {
  IIPP: 'Injury & Illness Prevention',
  HEAT_ILLNESS_PLAN: 'Heat illness plan',
  HAZ_COMM_PROGRAM: 'Hazard communication',
  RESPIRATORY_PROTECTION_PROGRAM: 'Respiratory protection',
  CONFINED_SPACE_PROGRAM: 'Confined space',
  CONTROL_OF_HAZ_ENERGY_LOTO: 'Lockout/tagout',
  EHS_PROGRAM: 'EHS program',
  SDS: 'SDS',
  OTHER: 'Other',
};

export default function SafetyLibraryPage() {
  const [asOf, setAsOf] = useState(todayIso());

  const sections = useMemo(() => {
    return SEED_DOCS.map((doc) => {
      const versions = SEED_VERSIONS.filter((v) => v.documentId === doc.id);
      const current = currentVersionAt(versions, asOf);
      const chain = historicalChain(versions);
      const pending = pendingChanges(versions, asOf, PENDING_WINDOW_DAYS);
      const overdue = staleByDays(current, asOf, STALE_THRESHOLD_DAYS);
      return { doc, current, chain, pending, overdue };
    });
  }, [asOf]);

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="Safety library"
          subtitle="Version-controlled IIPP, heat illness plan, haz-comm, LOTO, SDS. The version effective on the audit date is the one that counts."
        />

        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <label className="flex items-center gap-3 text-sm">
            <span className="font-medium text-gray-700">As of date:</span>
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
            <span className="text-xs text-gray-500">
              (changes which version of each doc is considered "current")
            </span>
          </label>
        </section>

        <p className="mb-4 text-xs italic text-gray-500">
          Sample documents shown — a future bundle wires real uploads through the doc-vault.
        </p>

        <div className="space-y-6">
          {sections.map(({ doc, current, chain, pending, overdue }) => (
            <article key={doc.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{doc.title}</h2>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    {KIND_LABEL[doc.kind]} · {doc.jurisdiction}
                    {doc.productIdentifier ? ` · ${doc.productIdentifier}` : ''}
                  </p>
                </div>
                {current ? (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                    Effective on {asOf}: {current.versionLabel}
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">
                    No version effective on {asOf}
                  </span>
                )}
              </header>

              {overdue !== null && (
                <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Current version is {overdue} day{overdue === 1 ? '' : 's'} past the {STALE_THRESHOLD_DAYS}-day review window. Cal/OSHA inspectors expect annual review of IIPPs.
                </p>
              )}

              {pending.length > 0 && (
                <p className="mt-3 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                  {pending.length} version{pending.length === 1 ? '' : 's'} take effect in the next {PENDING_WINDOW_DAYS} days: {pending.map((p) => `${p.versionLabel} (${p.effectiveOn})`).join(', ')}.
                </p>
              )}

              <h3 className="mt-4 text-sm font-semibold text-gray-700">Version history</h3>
              <table className="mt-2 w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-2">Label</th>
                    <th className="py-2">Effective</th>
                    <th className="py-2">Superseded</th>
                    <th className="py-2">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {chain.map((v) => {
                    const isCurrent = current?.id === v.id;
                    return (
                      <tr
                        key={v.id}
                        className={`border-t border-gray-200 ${isCurrent ? 'bg-green-50' : ''}`}
                      >
                        <td className="py-2 font-medium text-gray-900">
                          {v.versionLabel}
                          {isCurrent && (
                            <span className="ml-2 rounded bg-green-200 px-1.5 py-0.5 text-xs font-semibold text-green-900">
                              current
                            </span>
                          )}
                        </td>
                        <td className="py-2 font-mono text-xs text-gray-700">{v.effectiveOn}</td>
                        <td className="py-2 font-mono text-xs text-gray-500">
                          {v.supersededOn ?? '—'}
                        </td>
                        <td className="py-2 text-gray-700">{v.summary}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      </main>
    </AppShell>
  );
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
