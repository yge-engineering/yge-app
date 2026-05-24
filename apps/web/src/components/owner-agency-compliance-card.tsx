// Small read-only card that summarizes what compliance posture applies
// to a Plans-to-Estimate draft once the owner agency is classified.
// Rendered on /drafts/[id] next to the DraftView so the estimator
// sees the gating items (PW required? §4104 sub list? DAS-140 due?)
// before opening the working estimate.
//
// Server-component friendly: no client hooks, no state — the parent
// passes in the classification result already computed.

import type {
  OwnerAgencyClassification,
  PtoEProjectType,
} from '@yge/shared';
import { buildJobStartupChecklist } from '@yge/shared';

// Short, plain-English labels for each agency kind. Matches the
// CLAUDE.md "plain English" guidance — no agency acronyms without
// the spelled-out form on first reference.
const KIND_LABEL: Record<OwnerAgencyClassification['kind'], string> = {
  CALTRANS: 'Caltrans',
  CAL_FIRE: 'CAL FIRE',
  STATE_PARKS: 'California State Parks',
  COUNTY: 'County (NorCal)',
  MUNICIPAL: 'City / municipal',
  MUNICIPAL_UTILITY: 'Public utility district',
  FEDERAL_FOREST_SERVICE: 'U.S. Forest Service',
  FEDERAL_BLM: 'Bureau of Land Management',
  FEDERAL_BIA: 'Bureau of Indian Affairs / tribal',
  FEDERAL_OTHER: 'Other federal',
  PRIVATE: 'Private owner',
  UNCLASSIFIED: 'Unclassified — verify owner',
};

interface ChipProps {
  on: boolean;
  label: string;
}

function ComplianceChip({ on, label }: ChipProps) {
  // Green pill if the requirement applies (we'll have to do it).
  // Gray pill if it doesn't — still shown so the estimator can spot
  // a surprising "off" (e.g. private job that should be PW after all).
  const cls = on
    ? 'bg-green-100 text-green-800 border-green-200'
    : 'bg-gray-100 text-gray-500 border-gray-200';
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {on ? '✓' : '·'} {label}
    </span>
  );
}

interface Props {
  classification: OwnerAgencyClassification;
  /** Owner string the heuristic ran against. Surfaced so the user can
   *  sanity-check the input. */
  ownerLabel?: string;
  /** When provided, the card surfaces an "If awarded, do these first"
   *  preview of the top critical startup items so the estimator sees
   *  the post-award workload before they even submit the bid. */
  projectType?: PtoEProjectType;
}

export function OwnerAgencyComplianceCard({
  classification,
  ownerLabel,
  projectType,
}: Props) {
  const { kind, confidence, matchedSignals, compliance } = classification;
  const lowConfidence = confidence > 0 && confidence < 0.7;

  // Compute the top critical startup items when projectType + a
  // classified agency are both present. Showing 4 to keep the card
  // short — the editor can link to the full /jobs/[id]/startup-checklist
  // page later when one exists.
  const startupTop =
    projectType && kind !== 'UNCLASSIFIED'
      ? buildJobStartupChecklist({
          projectType,
          classification,
          hasListedSubs: true, // optimistic — true for most bid jobs
        })
          .items.filter((i) => i.severity === 'critical')
          .slice(0, 4)
      : [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Compliance posture
        </h3>
        {confidence > 0 && (
          <span
            className="text-[10px] uppercase tracking-wide text-gray-400"
            title={`Heuristic confidence: ${(confidence * 100).toFixed(0)}%`}
          >
            {(confidence * 100).toFixed(0)}% match
          </span>
        )}
      </header>

      <p className="text-sm text-gray-700">
        <span className="font-medium text-gray-900">{KIND_LABEL[kind]}</span>
        {ownerLabel && (
          <span className="ml-2 text-xs text-gray-500">· {ownerLabel}</span>
        )}
      </p>

      {lowConfidence && (
        <p className="mt-1 text-xs text-yellow-700">
          ⚠ Heuristic isn&apos;t sure — verify the owner before relying on these flags.
        </p>
      )}

      {kind === 'UNCLASSIFIED' && (
        <p className="mt-1 text-xs text-gray-500">
          No agency match. Set the owner on the working estimate to enable
          compliance defaults.
        </p>
      )}

      {kind !== 'UNCLASSIFIED' && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <ComplianceChip on={compliance.prevailingWage} label="CA prevailing wage" />
          <ComplianceChip on={compliance.davisBacon} label="Davis-Bacon" />
          <ComplianceChip on={compliance.das140Required} label="DAS-140 required" />
          <ComplianceChip on={compliance.subListingRequired} label="§4104 sub list" />
          <ComplianceChip on={compliance.swpppLikely} label="SWPPP likely" />
        </div>
      )}

      {startupTop.length > 0 && (
        <details className="mt-4 rounded-md border border-gray-100 bg-gray-50 p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-700">
            If awarded — first {startupTop.length} critical items
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-800">
            {startupTop.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.label}</span>
                {item.detail && (
                  <span className="ml-1 italic text-gray-500">— {item.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {matchedSignals.length > 0 && (
        <p
          className="mt-3 text-[10px] text-gray-400"
          title="Tokens that fired the classification"
        >
          Matched: {matchedSignals.join(' · ')}
        </p>
      )}
    </div>
  );
}
