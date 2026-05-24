'use client';

// Client island for the /ar-collections page that emits a CSV of the
// ranked Monday list. Same pattern as DraftView's CSV buttons —
// download as file, copy to clipboard.

import { useState } from 'react';
import { csvEscape, formatUSD, type ArCollectionAction } from '@yge/shared';

interface RankedRow {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amountOutstandingCents: number;
  ageDays: number;
  action: ArCollectionAction;
  actionLabel: string;
  reason: string;
}

interface Props {
  rows: RankedRow[];
}

const HEADERS = [
  'Customer',
  'Invoice #',
  'Amount outstanding',
  'Days past due',
  'Recommended action',
  'Why',
] as const;

function rowsToCsv(rows: RankedRow[]): string {
  const out: string[] = [HEADERS.map(csvEscape).join(',')];
  for (const r of rows) {
    out.push(
      [
        r.customerName,
        r.invoiceNumber,
        // Bare-decimal dollars — no $ sign so Excel reads as number.
        (r.amountOutstandingCents / 100).toFixed(2),
        r.ageDays,
        r.actionLabel,
        r.reason,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return out.join('\r\n') + '\r\n';
}

function filename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `ar-collections-${today}.csv`;
}

export function ArCollectionsCsvButtons({ rows }: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  function handleDownload() {
    const csv = rowsToCsv(rows);
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    const csv = rowsToCsv(rows);
    try {
      await navigator.clipboard.writeText(csv);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 3000);
    }
  }

  // Convenience: a small inline summary above the buttons so the
  // estimator knows what'll be exported.
  const totalCents = rows.reduce((s, r) => s + r.amountOutstandingCents, 0);

  return (
    <div className="flex flex-col items-end gap-1">
      <p className="text-[11px] uppercase tracking-wider text-gray-500">
        {rows.length} row{rows.length === 1 ? '' : 's'} · {formatUSD(totalCents, { compact: true })}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={handleDownload}
          disabled={rows.length === 0}
          className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-700 hover:bg-yge-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Download CSV
        </button>
        <button
          onClick={handleCopy}
          disabled={rows.length === 0}
          className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copyState === 'copied'
            ? 'Copied!'
            : copyState === 'error'
              ? 'Copy failed'
              : 'Copy CSV'}
        </button>
      </div>
    </div>
  );
}
