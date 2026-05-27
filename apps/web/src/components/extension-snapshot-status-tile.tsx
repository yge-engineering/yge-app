import * as React from 'react';
import {
  EXTENSION_SNAPSHOT_FIELD_LABELS,
  type ExtensionProfileSnapshot,
} from '@yge/shared';
import { isNextInternalError } from '../lib/next-control-flow';

// Extension snapshot status tile.
//
// Fetches /api/extension/profile-snapshot and counts how many
// string fields are populated. Surfaces "23 of 27 fields will
// auto-fill" so Ryan sees at a glance whether the snapshot is
// fully populated for his master profile.
//
// Empty fields are common pre-go-live (federalEin, caMcpNumber,
// caEntityNumber, expiry dates aren't on YGE_COMPANY_INFO yet);
// the tile flags this rather than letting Ryan discover it form-
// by-form when fields don't fill.

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchSnapshot(): Promise<ExtensionProfileSnapshot | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/extension/profile-snapshot`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ExtensionProfileSnapshot;
  } catch {
    return null;
  }
}

// Fields we expect the snapshot to populate. schemaVersion +
// generatedAt are bookkeeping and not "fill-target" fields, so
// we exclude them from the denominator.
const NON_FILL_FIELDS = new Set(['schemaVersion', 'generatedAt']);

function labelFor(field: string): string {
  return (
    EXTENSION_SNAPSHOT_FIELD_LABELS[
      field as keyof typeof EXTENSION_SNAPSHOT_FIELD_LABELS
    ] ?? field
  );
}

async function ExtensionSnapshotStatusTileInner(): Promise<React.ReactElement | null> {
  const snapshot = await fetchSnapshot();
  if (!snapshot) return null;

  const entries = Object.entries(snapshot).filter(
    ([k]) => !NON_FILL_FIELDS.has(k),
  );
  const populated = entries.filter(
    ([, v]) => typeof v === 'string' && v.length > 0,
  ).length;
  const emptyFields = entries
    .filter(([, v]) => typeof v !== 'string' || v.length === 0)
    .map(([k]) => k);
  const total = entries.length;
  const empty = emptyFields.length;

  const tone =
    empty === 0
      ? 'border-green-300 bg-green-50 text-green-900'
      : empty <= 3
        ? 'border-gray-200 bg-gray-50 text-gray-800'
        : 'border-amber-300 bg-amber-50 text-amber-900';

  return (
    <section className={`mt-4 rounded-md border p-3 text-xs ${tone}`}>
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide">
          Extension snapshot
        </h2>
        <a
          href={`${apiBaseUrl()}/api/extension/profile-snapshot`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono underline-offset-2 hover:underline"
          title="View raw snapshot JSON"
          aria-label={`${populated} of ${total} snapshot fields populated — open raw JSON in new tab`}
        >
          {populated} / {total} fields populated
        </a>
      </header>
      {empty > 0 && (
        <>
          <p className="mt-1">
            {empty} field{empty === 1 ? '' : 's'} still empty — agency forms
            asking for those will land unmatched. Edit{' '}
            <code className="rounded bg-white px-1 py-0.5 font-mono">
              packages/shared/src/company.ts
            </code>{' '}
            to populate.
          </p>
          <p className="mt-1 opacity-80">
            Empty: {(() => {
              // Long lists get capped at 8 to keep the tile from
              // ballooning on a fresh tenant; remainder counted.
              const labeled = emptyFields.map(labelFor);
              if (labeled.length <= 8) return labeled.join(', ');
              return (
                labeled.slice(0, 8).join(', ') +
                ` … +${labeled.length - 8} more`
              );
            })()}
          </p>
        </>
      )}
    </section>
  );
}

export async function ExtensionSnapshotStatusTile(): Promise<React.ReactElement | null> {
  try {
    return await ExtensionSnapshotStatusTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[ExtensionSnapshotStatusTile] render failed:', err);
    return null;
  }
}
