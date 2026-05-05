'use client';

// EmployeeDeleteButton — destructive remove with a native confirm
// gate. Used on the employee detail page and inline on the roster.
//
// Why two destructive paths exist: this calls DELETE /api/employees/:id
// which removes the row. For most "fired" cases prefer the status
// editor — it flips status to TERMINATED and keeps the record so
// payroll history still resolves the name.

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  employeeId: string;
  /** Display name shown in the confirm dialog. */
  name: string;
  apiBaseUrl: string;
  /** Where to go after a successful delete. Defaults to /employees. */
  redirectTo?: string;
  /** Visual variant — full button or compact icon-style trash link. */
  variant?: 'button' | 'compact';
}

export function EmployeeDeleteButton({
  employeeId,
  name,
  apiBaseUrl,
  redirectTo = '/employees',
  variant = 'button',
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    const ok = window.confirm(
      `Delete ${name}? This permanently removes the employee record. ` +
        `If this person worked for YGE and you need to keep payroll ` +
        `history, choose "Mark Terminated" instead.`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/employees/${encodeURIComponent(employeeId)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Delete failed (${res.status}): ${text.slice(0, 200)}`);
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
      setBusy(false);
    }
  }

  if (variant === 'compact') {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
        {error && <span className="text-xs text-red-700">{error}</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? 'Deleting…' : 'Delete employee'}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
