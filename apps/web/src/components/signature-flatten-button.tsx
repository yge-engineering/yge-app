// Flatten + finalize a SIGNED signature row.
//
// Calls POST /api/signatures/:id/flatten which embeds the captured
// PNG into the source PDF, writes the flattened bytes to disk,
// computes the SHA-256, and stamps it onto the row via finalize.
// Once finalized, the page re-renders with a download link.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';

interface Props {
  apiBaseUrl: string;
  signatureId: string;
}

export function SignatureFlattenButton({ apiBaseUrl, signatureId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslator();

  async function flatten() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/signatures/${signatureId}/flatten`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? t('sigFlatten.error', { status: res.status }));
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={flatten}
        disabled={busy}
        className="rounded bg-yge-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
      >
        {busy ? t('sigFlatten.busy') : t('sigFlatten.action')}
      </button>
      {error && <span className="text-xs text-red-700">⚠ {error}</span>}
    </span>
  );
}
