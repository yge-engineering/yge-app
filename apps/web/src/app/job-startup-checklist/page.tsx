'use client';

// /job-startup-checklist — preview the post-award startup checklist
// for a hypothetical job. URL params drive the inputs so Ryan can
// send a link to Brook ("here's everything we'd need to do if we
// take this contract").
//
// Inputs (all optional, sensible defaults):
//   ?projectType=ROAD_RECONSTRUCTION | DRAINAGE | BRIDGE | GRADING |
//                 FIRE_FUEL_REDUCTION | OTHER
//   ?owner=California Department of Transportation
//   ?amount=1500000  (dollars; defaults to "unspecified")
//   ?hasSubs=true | false

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import {
  buildJobStartupChecklist,
  classifyOwnerAgency,
  type PtoEProjectType,
} from '@yge/shared';

import { AppShell, PageHeader } from '../../components';

const PROJECT_TYPES: PtoEProjectType[] = [
  'ROAD_RECONSTRUCTION',
  'DRAINAGE',
  'BRIDGE',
  'GRADING',
  'FIRE_FUEL_REDUCTION',
  'OTHER',
];

const CATEGORY_LABEL: Record<string, string> = {
  COMPLIANCE: 'Compliance',
  SUBCONTRACTS: 'Subcontracts',
  FIELD: 'Field',
  PAPERWORK: 'Paperwork',
  SAFETY: 'Safety',
};

function isProjectType(s: string): s is PtoEProjectType {
  return (PROJECT_TYPES as string[]).includes(s);
}

export default function JobStartupChecklistPage() {
  const params = useSearchParams();
  const projectTypeRaw = params.get('projectType') ?? 'ROAD_RECONSTRUCTION';
  const projectType: PtoEProjectType = isProjectType(projectTypeRaw)
    ? projectTypeRaw
    : 'ROAD_RECONSTRUCTION';
  const owner = params.get('owner') ?? '';
  const amountDollarsParam = params.get('amount');
  const awardedAmountCents =
    amountDollarsParam && /^\d+(?:\.\d+)?$/.test(amountDollarsParam)
      ? Math.round(Number(amountDollarsParam) * 100)
      : undefined;
  const hasSubs = params.get('hasSubs') !== 'false'; // default true

  const classification = useMemo(
    () => classifyOwnerAgency({ ownerName: owner }),
    [owner],
  );

  const checklist = useMemo(
    () =>
      buildJobStartupChecklist({
        projectType,
        classification,
        hasListedSubs: hasSubs,
        awardedAmountCents,
      }),
    [projectType, classification, hasSubs, awardedAmountCents],
  );

  // Bucket items by category for the section grouping.
  const buckets = new Map<string, typeof checklist.items>();
  for (const item of checklist.items) {
    const arr = buckets.get(item.category) ?? [];
    arr.push(item);
    buckets.set(item.category, arr);
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-8">
        <PageHeader
          title="Job startup checklist"
          subtitle="What YGE needs to do BEFORE the first crew rolls, derived from the project type + owner-agency compliance posture."
        />

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Inputs
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700">
            <dt className="font-medium">Project type</dt>
            <dd>{projectType.replace(/_/g, ' ')}</dd>
            <dt className="font-medium">Owner</dt>
            <dd>{owner || <span className="text-gray-400">unspecified</span>}</dd>
            <dt className="font-medium">Classified as</dt>
            <dd>
              {classification.kind.replace(/_/g, ' ')}{' '}
              {classification.confidence > 0 && (
                <span className="text-xs text-gray-500">
                  ({(classification.confidence * 100).toFixed(0)}% match)
                </span>
              )}
            </dd>
            <dt className="font-medium">Award amount</dt>
            <dd>
              {awardedAmountCents != null
                ? `$${(awardedAmountCents / 100).toLocaleString()}`
                : <span className="text-gray-400">unspecified</span>}
            </dd>
            <dt className="font-medium">Listed subs?</dt>
            <dd>{hasSubs ? 'Yes' : 'No'}</dd>
          </dl>
          <p className="mt-3 text-xs text-gray-500">
            Pass <code className="rounded bg-gray-100 px-1">?owner=Caltrans</code>,
            <code className="ml-1 rounded bg-gray-100 px-1">&amp;projectType=GRADING</code>,
            <code className="ml-1 rounded bg-gray-100 px-1">&amp;amount=1500000</code>,
            or <code className="ml-1 rounded bg-gray-100 px-1">&amp;hasSubs=false</code> in the URL to tailor.
          </p>
        </section>

        <section className="mt-6 space-y-5">
          {[...buckets.entries()].map(([category, items]) => (
            <div
              key={category}
              className="rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <header className="border-b border-gray-100 bg-gray-50 px-5 py-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                  {CATEGORY_LABEL[category] ?? category}
                  <span className="ml-2 text-xs font-normal lowercase tracking-normal text-gray-500">
                    {items.length} item{items.length === 1 ? '' : 's'}
                  </span>
                </h3>
              </header>
              <ul className="divide-y divide-gray-100">
                {items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-1 inline-block h-3 w-3 flex-shrink-0 rounded border border-gray-400" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {item.label}
                        </span>
                        {item.severity === 'critical' && (
                          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800">
                            Critical
                          </span>
                        )}
                      </div>
                      {item.detail && (
                        <p className="mt-0.5 text-xs italic text-gray-600">
                          {item.detail}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
