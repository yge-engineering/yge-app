// Manual YGE cross-link form for bid tabs.
//
// Shown on /bid-tabs/[id] when the auto-linker (bundle 622) didn't
// match — typically because the tab's projectName had agency-prefix
// noise our prefix-match couldn't strip, or the bid-open dates
// drifted by more than ±1 day. The operator picks the right YGE
// BidResult from a dropdown and we PATCH /api/bid-tabs/:id/yge-link.
//
// The dropdown shows the candidate BidResults newest-first with
// 'projectName · YYYY-MM-DD' so the operator picks visually.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';

interface BidResultOption {
  bidResultId: string;
  jobId: string;
  projectName: string;
  bidOpenedAt: string;
}

interface Props {
  apiBaseUrl: string;
  tabId: string;
  candidates: BidResultOption[];
}

export function BidTabYgeLinkForm({ apiBaseUrl, tabId, candidates }: Props) {
  const router = useRouter();
  const t = useTranslator();
  const [picked, setPicked] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy || !picked) return;
    setError(null);
    const candidate = candidates.find((c) => c.bidResultId === picked);
    if (!candidate) {
      setError(t('bidTabYgeLink.errPick'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/bid-tabs/${tabId}/yge-link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ygeBidResultId: candidate.bidResultId,
          ygeJobId: candidate.jobId,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? t('bidTabYgeLink.errFail', { status: res.status }));
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (candidates.length === 0) {
    // Empty-state has an inline link — split-and-fill via __LINK__ sentinel.
    const emptyTpl = t('bidTabYgeLink.empty', { link: '__LINK__' });
    const [emptyPre, emptyPost] = emptyTpl.split('__LINK__');
    return (
      <p className="text-xs text-gray-600">
        {emptyPre}
        <a href="/bid-results/new" className="text-yge-blue-500 hover:underline">
          /bid-results/new
        </a>
        {emptyPost}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select
        value={picked}
        onChange={(e) => setPicked(e.target.value)}
        disabled={busy}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
      >
        <option value="">{t('bidTabYgeLink.placeholder')}</option>
        {candidates.map((c) => (
          <option key={c.bidResultId} value={c.bidResultId}>
            {c.projectName} · {c.bidOpenedAt}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={busy || !picked}
        className="rounded bg-yge-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
      >
        {busy ? t('bidTabYgeLink.busy') : t('bidTabYgeLink.action')}
      </button>
      {error && <span className="text-red-700">⚠ {error}</span>}
    </div>
  );
}
