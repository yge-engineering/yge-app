'use client';

// ApReextractButton — re-run the AI extractor on the saved invoice
// PDF. Useful when the original auto-poll's extraction failed
// (transient Anthropic outage, missing key at the time) and the AP
// clerk wants to retry without re-pulling from email.
//
// Hidden when the row has no saved attachment marker.

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  invoiceId: string;
  apiBaseUrl: string;
}

interface Resp {
  extracted?: {
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    extractionNotes?: string;
  };
  error?: string;
}

export function ApReextractButton({ invoiceId, apiBaseUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reextract() {
    if (
      !window.confirm(
        'Re-run AI extraction on the saved PDF? This overwrites vendor / totals / line items with the new extraction; the existing notes are preserved underneath.',
      )
    )
      return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/ap-invoices/${encodeURIComponent(invoiceId)}/re-extract`,
        { method: 'POST' },
      );
      const data = (await res.json().catch(() => ({}))) as Resp;
      if (!res.ok) {
        throw new Error(data.error ?? `Re-extract failed (${res.status})`);
      }
      setMessage(
        `Re-extracted with confidence ${data.extracted?.confidence ?? 'unknown'}.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-extract failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={reextract}
        disabled={busy}
        className="rounded-md border border-blue-700 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
      >
        {busy ? 'Re-extracting…' : '↻ Re-extract from PDF'}
      </button>
      {message && <span className="text-xs text-green-700">{message}</span>}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
