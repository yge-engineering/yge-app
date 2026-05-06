'use client';

// Copy-an-estimate link used on /estimates rows.
//
// Plain English: the next bid usually looks like a previous one.
// Click "Copy" → enter a name → server clones the estimate's bid
// items + buildups + markup stack, drops the user on the editor
// for the new copy. The original is untouched.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  sourceId: string;
  sourceProjectName: string;
  sourceJobId: string;
  apiBaseUrl: string;
}

export function CopyEstimateLink({
  sourceId,
  sourceProjectName,
  sourceJobId,
  apiBaseUrl,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    if (busy) return;
    const projectName = window.prompt(
      'Project name for the new estimate:',
      `${sourceProjectName} (copy)`,
    );
    if (projectName == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/priced-estimates/from-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceEstimateId: sourceId,
          jobId: sourceJobId,
          projectName: projectName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { estimate: { id: string } };
      router.push(`/estimates/${json.estimate.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copy failed');
      setBusy(false);
    }
  }

  return (
    <span>
      <button
        type="button"
        onClick={() => void copy()}
        disabled={busy}
        className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50 disabled:opacity-60"
        title="Start a new estimate using this one as a template"
      >
        {busy ? 'Copying…' : 'Copy →'}
      </button>
      {error && <span className="ml-1 text-red-700">⚠ {error}</span>}
    </span>
  );
}
