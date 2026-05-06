'use client';

// Copies window.location.href to clipboard.

import { useState } from 'react';

export function CopyPageUrlButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        const url = typeof window !== 'undefined' ? window.location.href : '';
        navigator.clipboard?.writeText(url).catch(() => {
          // best-effort
        });
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
      title="Copy this page's URL to clipboard"
    >
      {copied ? '✓ Copied' : '🔗 Copy link'}
    </button>
  );
}
