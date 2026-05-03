// Clear the YGE cross-link on a bid tab.
//
// Pairs with bundle 633's link-form. When the operator wired the
// tab to the wrong BidResult (or wants to undo an auto-link to
// re-pick), this button PATCHes both YGE fields to null and
// refreshes — surfaces the manual-link form again.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';

interface Props {
  apiBaseUrl: string;
  tabId: string;
}

export function BidTabYgeUnlinkButton({ apiBaseUrl, tabId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslator();

  async function unlink() {
    if (busy) return;
    if (typeof window !== 'undefined') {
      const ok = window.confirm(t('bidTabUnlink.confirm'));
      if (!ok) return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/bid-tabs/${tabId}/yge-link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ygeJobId: null, ygeBidResultId: null }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? t('bidTabUnlink.error', { status: res.status }));
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
        onClick={unlink}
        disabled={busy}
        className="rounded border border-amber-500 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
      >
        {busy ? t('bidTabUnlink.busy') : t('bidTabUnlink.action')}
      </button>
      {error && <span className="text-[11px] text-red-700">⚠ {error}</span>}
    </span>
  );
}
