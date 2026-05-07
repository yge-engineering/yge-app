// Pre-fill the bid-tab import form from a PDF using AI extraction.

'use client';

import { useRef, useState } from 'react';

interface ExtractedBidder {
  rank?: number | null;
  name: string;
  totalCents: number;
  cslbLicense?: string | null;
}

interface ExtractResult {
  agencyName: string | null;
  projectName: string | null;
  projectNumber: string | null;
  county: string | null;
  bidOpenedAt: string | null;
  engineersEstimateCents: number | null;
  bidders: ExtractedBidder[];
}

export interface BidTabExtractButtonProps {
  apiBaseUrl: string;
  onResult: (result: ExtractResult) => void;
}

export function BidTabExtractButton({
  apiBaseUrl,
  onResult,
}: BidTabExtractButtonProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${apiBaseUrl}/api/bid-tabs/extract`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Extract failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as ExtractResult;
      onResult(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      // Reset so picking the same file again still triggers onChange.
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="mb-4 rounded-md border border-yge-blue-200 bg-yge-blue-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <strong className="text-yge-blue-900">AI extract:</strong>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={onChange}
          disabled={busy}
          className="text-xs"
        />
        {busy ? <span className="text-xs text-gray-700">Reading PDF…</span> : null}
        <span className="text-xs text-gray-600">
          Pick a Caltrans / county / agency bid-tab PDF — the form
          pre-fills below. You still review + Save.
        </span>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
