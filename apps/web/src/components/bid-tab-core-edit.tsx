// Inline core-fields edit form for /bid-tabs/[id].
//
// Operators routinely fix typos in agency name, project name, or
// fill in missing metadata after import (the scraper often leaves
// projectNumber blank, the operator pastes county wrong, etc.).
// This is the minimal-state collapsible editor — bidder-list,
// notes, and YGE-link edits live in their own forms.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface InitialFields {
  agencyName: string;
  projectName: string;
  projectNumber: string;
  county: string;
  bidOpenedAt: string;
  engineersEstimateDollars: string;
  sourceUrl: string;
  awardedToBidderName: string;
  awardedAt: string;
}

interface Props {
  apiBaseUrl: string;
  tabId: string;
  initial: InitialFields;
}

function parseDollars(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (cleaned.length === 0) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number.parseFloat(cleaned) * 100);
}

export function BidTabCoreEdit({ apiBaseUrl, tabId, initial }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [agencyName, setAgencyName] = useState(initial.agencyName);
  const [projectName, setProjectName] = useState(initial.projectName);
  const [projectNumber, setProjectNumber] = useState(initial.projectNumber);
  const [county, setCounty] = useState(initial.county);
  const [bidOpenedAt, setBidOpenedAt] = useState(initial.bidOpenedAt);
  const [eeDollars, setEeDollars] = useState(initial.engineersEstimateDollars);
  const [sourceUrl, setSourceUrl] = useState(initial.sourceUrl);
  const [awardedTo, setAwardedTo] = useState(initial.awardedToBidderName);
  const [awardedAt, setAwardedAt] = useState(initial.awardedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAgencyName(initial.agencyName);
    setProjectName(initial.projectName);
    setProjectNumber(initial.projectNumber);
    setCounty(initial.county);
    setBidOpenedAt(initial.bidOpenedAt);
    setEeDollars(initial.engineersEstimateDollars);
    setSourceUrl(initial.sourceUrl);
    setAwardedTo(initial.awardedToBidderName);
    setAwardedAt(initial.awardedAt);
    setError(null);
  }

  async function save() {
    if (busy) return;
    setError(null);
    if (!agencyName.trim() || !projectName.trim() || !bidOpenedAt) {
      setError('Agency name, project name, and bid-opened date are required.');
      return;
    }
    const ee = eeDollars.trim().length === 0 ? null : parseDollars(eeDollars);
    if (ee === null && eeDollars.trim().length > 0) {
      setError('Engineer’s estimate must be a dollar amount (or empty).');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/bid-tabs/${tabId}/core`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyName: agencyName.trim(),
          projectName: projectName.trim(),
          projectNumber: projectNumber.trim().length === 0 ? null : projectNumber.trim(),
          county: county.trim().length === 0 ? null : county.trim(),
          bidOpenedAt,
          engineersEstimateCents: ee,
          sourceUrl: sourceUrl.trim().length === 0 ? null : sourceUrl.trim(),
          awardedToBidderName: awardedTo.trim().length === 0 ? null : awardedTo.trim(),
          awardedAt: awardedAt.trim().length === 0 ? null : awardedAt,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Save failed (${res.status})`);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-[11px] text-yge-blue-500 hover:underline"
      >
        Edit core fields →
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-yge-blue-500 bg-yge-blue-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2 text-xs">
        <Field label="Agency name *">
          <input
            type="text"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </Field>
        <Field label="County">
          <input
            type="text"
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </Field>
        <Field label="Project name *" full>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </Field>
        <Field label="Project / contract number">
          <input
            type="text"
            value={projectNumber}
            onChange={(e) => setProjectNumber(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </Field>
        <Field label="Bid opened *">
          <input
            type="date"
            value={bidOpenedAt}
            onChange={(e) => setBidOpenedAt(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </Field>
        <Field label="Engineer's estimate ($)">
          <input
            type="text"
            value={eeDollars}
            onChange={(e) => setEeDollars(e.target.value)}
            placeholder="e.g. 4,250,000"
            className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-xs"
          />
        </Field>
        <Field label="Awarded to (name)">
          <input
            type="text"
            value={awardedTo}
            onChange={(e) => setAwardedTo(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </Field>
        <Field label="Awarded date">
          <input
            type="date"
            value={awardedAt}
            onChange={(e) => setAwardedAt(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </Field>
        <Field label="Source URL" full>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://agency.gov/.../bid-tab.pdf"
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded bg-yge-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setEditing(false);
          }}
          disabled={busy}
          className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Cancel
        </button>
        {error && <span className="text-[11px] text-red-700">⚠ {error}</span>}
      </div>
    </div>
  );
}

function Field({
  label, full, children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={full ? 'block sm:col-span-2' : 'block'}>
      <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-gray-600">{label}</span>
      {children}
    </label>
  );
}
