// Release-legal-hold button. Prompts for required reason, POSTs.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';

interface Props {
  apiBaseUrl: string;
  holdId: string;
}

export function LegalHoldReleaseButton({ apiBaseUrl, holdId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslator();

  async function release() {
    if (busy) return;
    const reason = window.prompt(t('legalHold.prompt'));
    if (reason === null) return;
    if (reason.trim().length === 0) {
      window.alert(t('legalHold.required'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/legal-holds/${holdId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releasedReason: reason }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? t('legalHold.error', { status: res.status }));
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
        onClick={release}
        disabled={busy}
        className="rounded border border-emerald-600 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
      >
        {busy ? t('legalHold.busy') : t('legalHold.action')}
      </button>
      {error && (
        <span className="text-xs text-red-700" title={error}>
          ⚠
        </span>
      )}
    </span>
  );
}
