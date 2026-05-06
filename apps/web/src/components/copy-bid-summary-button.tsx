'use client';

// Small client toolbar button that copies a one-line bid summary
// to the user's clipboard. Used on /estimates/[id] alongside the
// other toolbar buttons. Safe noop when navigator.clipboard is
// unavailable (no HTTPS in some dev contexts).

import { useState } from 'react';

interface Props {
  projectName: string;
  bidTotalCents: number;
  bidItemCount: number;
  subBidCount: number;
}

function formatMoney(cents: number): string {
  // Round to whole dollars for the chat-friendly summary; pennies
  // aren't useful when you're bantering about the bid total.
  const dollars = Math.round(cents / 100);
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function CopyBidSummaryButton({
  projectName,
  bidTotalCents,
  bidItemCount,
  subBidCount,
}: Props) {
  const [copied, setCopied] = useState(false);
  const summary =
    `${projectName} — bid ${formatMoney(bidTotalCents)}, ` +
    `${bidItemCount} line${bidItemCount === 1 ? '' : 's'}` +
    (subBidCount > 0 ? `, ${subBidCount} sub${subBidCount === 1 ? '' : 's'}` : '');

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Best-effort fallback: select via a temporary textarea.
      const ta = document.createElement('textarea');
      ta.value = summary;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch {
        // give up silently
      }
      document.body.removeChild(ta);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={`Copy: ${summary}`}
      className="rounded border border-yge-blue-500 px-3 py-1 font-medium text-yge-blue-500 hover:bg-yge-blue-50"
    >
      {copied ? '✓ Copied' : '📋 Copy summary'}
    </button>
  );
}
