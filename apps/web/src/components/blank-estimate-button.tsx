'use client';

// Posts to /api/priced-estimates/blank and redirects to the new editor.
// Used on /jobs/[id] when the estimator wants to type bid items by
// hand instead of starting from Plans-to-Estimate.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  jobId: string;
  projectName: string;
  projectType?: string;
  ownerAgency?: string;
  location?: string;
  bidDueDate?: string;
  /** Style override so the parent page can match its own button cluster. */
  className?: string;
  label?: string;
}

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

const PROJECT_TYPES = new Set([
  'ROAD_RECONSTRUCTION',
  'DRAINAGE',
  'BRIDGE',
  'GRADING',
  'FIRE_FUEL_REDUCTION',
  'OTHER',
]);

export function BlankEstimateButton({
  jobId,
  projectName,
  projectType,
  ownerAgency,
  location,
  bidDueDate,
  className,
  label,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        jobId,
        projectName,
        projectType:
          projectType && PROJECT_TYPES.has(projectType) ? projectType : 'OTHER',
        ownerAgency,
        location,
        bidDueDate,
      };
      const res = await fetch(`${apiBase()}/api/priced-estimates/blank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`API ${res.status}: ${t.slice(0, 200)}`);
      }
      const json = (await res.json()) as { estimate?: { id?: string } };
      const id = json.estimate?.id;
      if (!id) throw new Error('No estimate id in response');
      router.push(`/estimates/${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create blank estimate');
      setBusy(false);
    }
  }

  return (
    <span className="inline-block">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={
          className ??
          'rounded border border-yge-blue-500 px-3 py-1.5 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50 disabled:opacity-60'
        }
        title="Create an empty estimate and edit lines manually"
      >
        {busy ? 'Creating…' : (label ?? '+ Blank estimate')}
      </button>
      {err ? (
        <span className="ml-2 text-[11px] text-red-700">{err}</span>
      ) : null}
    </span>
  );
}
