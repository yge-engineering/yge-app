// Mark-all-paid button for the per-employee reimbursement page.
//
// Loops through every mileage + expense id and PATCHes
// `reimbursed=true, reimbursedOn=today`. Phase 2 will replace this
// with a single bulk endpoint that also auto-posts a JE.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatUSD } from '@yge/shared';
import { useTranslator } from '../lib/use-translator';

export function ReimbursementMarkPaidButton({
  apiBaseUrl,
  mileageIds,
  expenseIds,
  totalCents,
}: {
  apiBaseUrl: string;
  mileageIds: string[];
  expenseIds: string[];
  totalCents: number;
}) {
  const router = useRouter();
  const t = useTranslator();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function markAllPaid() {
    const total = mileageIds.length + expenseIds.length;
    if (total === 0) return;
    const confirmMsg =
      total === 1
        ? t('reimbursementMarkPaid.confirmOne', { amount: formatUSD(totalCents) })
        : t('reimbursementMarkPaid.confirmMany', { count: total, amount: formatUSD(totalCents) });
    if (!confirm(confirmMsg)) {
      return;
    }
    setBusy(true);
    setError(null);
    const today = new Date().toISOString().slice(0, 10);
    let done = 0;
    setProgress({ done, total });
    try {
      for (const id of mileageIds) {
        const res = await fetch(`${apiBaseUrl}/api/mileage/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reimbursed: true, reimbursedOn: today }),
        });
        if (!res.ok) throw new Error(`Mileage ${id}: ${res.status}`);
        done += 1;
        setProgress({ done, total });
      }
      for (const id of expenseIds) {
        const res = await fetch(`${apiBaseUrl}/api/expenses/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reimbursed: true, reimbursedOn: today }),
        });
        if (!res.ok) throw new Error(`Expense ${id}: ${res.status}`);
        done += 1;
        setProgress({ done, total });
      }
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
        onClick={markAllPaid}
        disabled={busy}
        className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700 disabled:opacity-50"
      >
        {busy
          ? t('reimbursementMarkPaid.busy', {
              done: progress?.done ?? 0,
              total: progress?.total ?? 0,
            })
          : t('reimbursementMarkPaid.action', { amount: formatUSD(totalCents) })}
      </button>
      {error && <span className="mt-1 text-xs text-red-700">{error}</span>}
    </div>
  );
}
