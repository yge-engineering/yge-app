'use client';

// Tiny chip showing a short id; clicking copies the full id to clipboard.

import { useState } from 'react';

interface Props {
  id: string;
  /** How many chars of the rand-suffix to show. Default 8. */
  short?: number;
  /** Optional label prefix, e.g. "est". */
  label?: string;
}

export function CopyIdChip({ id, short = 8, label }: Props) {
  const [copied, setCopied] = useState(false);
  // Show the trailing random hex chunk so the chip is short.
  const tail = id.split('-').slice(-1)[0] ?? id;
  const display = tail.length > short ? tail.slice(0, short) : tail;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(id).catch(() => {});
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      title={`Copy id: ${id}`}
      className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[10px] text-gray-600 hover:bg-gray-100"
    >
      {copied ? '✓ Copied' : `${label ? label + ' ' : ''}${display}`}
    </button>
  );
}
