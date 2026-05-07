'use client';

// Wraps a Money render in a button that copies the formatted dollar
// amount to clipboard on click. Shows brief "Copied" pill.

import { useState } from 'react';

interface Props {
  cents: number;
  /** Same display as <Money>; we just call it via children to avoid
   *  re-implementing locale/currency logic. */
  children: React.ReactNode;
}

function formatPlainDollars(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CopyMoneyButton({ cents, children }: Props) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        const text = formatPlainDollars(cents);
        navigator.clipboard?.writeText(text).catch(() => {
          // best-effort fallback
        });
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      title={`Click to copy ${formatPlainDollars(cents)}`}
      className="cursor-pointer hover:underline print:cursor-default print:no-underline print:hover:no-underline"
    >
      {copied ? <span className="text-green-700">✓ Copied</span> : children}
    </button>
  );
}
