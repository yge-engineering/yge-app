// Apply-default-COA-seed button. Hits the idempotent /api/coa/seed
// endpoint and refreshes the page on success.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';

export function CoaSeedButton({ apiBaseUrl }: { apiBaseUrl: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslator();

  async function applySeed() {
    if (!confirm(t('coaSeed.confirm'))) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/coa/seed`, { method: 'POST' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={applySeed}
        disabled={busy}
        className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50 disabled:opacity-50"
      >
        {busy ? t('coaSeed.busy') : t('coaSeed.apply')}
      </button>
      {error && <span className="mt-1 text-xs text-red-700">{error}</span>}
    </div>
  );
}
