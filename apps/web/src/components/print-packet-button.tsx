'use client';

// Opens every artifact in the bid packet in a separate tab with
// ?autoPrint=1 so each one fires its print dialog as it loads. The
// estimator gets four print dialogs back-to-back without having to
// click into each page.
//
// Pop-up blockers will trip on this if window.open is called too
// many times in one synchronous tick. We stagger by 200 ms each,
// which keeps Chrome / Safari happy and reads as "tabs opening one
// after the other" instead of a single sketchy spam.

import { useState } from 'react';

interface Props {
  estimateId: string;
  /** When true, sub-leveling is included too. Default false — the
   *  sub-leveling print is internal reference, not part of what
   *  goes in the envelope. */
  includeSubLeveling?: boolean;
}

export function PrintPacketButton({ estimateId, includeSubLeveling = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (typeof window === 'undefined') return;
    setError(null);
    setBusy(true);

    const paths = [
      `/estimates/${estimateId}/print`,
      `/estimates/${estimateId}/sub-list`,
      `/estimates/${estimateId}/transmittal`,
      `/estimates/${estimateId}/envelope`,
    ];
    if (includeSubLeveling) {
      paths.push(`/estimates/${estimateId}/sub-leveling`);
    }

    let opened = 0;
    paths.forEach((path, idx) => {
      window.setTimeout(() => {
        const win = window.open(`${path}?autoPrint=1`, '_blank');
        if (!win) {
          setError(
            'Browser blocked one or more pop-ups. Allow pop-ups for this site, then click again.',
          );
        } else {
          opened += 1;
        }
        if (idx === paths.length - 1) {
          setBusy(false);
        }
      }, idx * 200);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={busy}
        className="rounded-md bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        title="Opens bid summary, §4104 sub list, transmittal, and envelope checklist in separate tabs — each one fires its print dialog as it loads."
      >
        {busy ? 'Opening tabs…' : 'Print full bid packet →'}
      </button>
      {error && <p className="max-w-xs text-right text-xs text-red-700">{error}</p>}
    </div>
  );
}
