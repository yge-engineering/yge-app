'use client';

// EmployeeRowActions — inline "Fire" / "Delete" controls for a row on
// the /employees roster. "Fire" flips status → TERMINATED via PATCH;
// "Delete" hits DELETE /api/employees/:id after a confirm.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Employee } from '@yge/shared';

interface Props {
  employee: Employee;
  apiBaseUrl: string;
}

export function EmployeeRowActions({ employee, apiBaseUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | 'fire' | 'delete'>(null);
  const [error, setError] = useState<string | null>(null);

  async function fire() {
    if (employee.status === 'TERMINATED') return;
    const ok = window.confirm(
      `Mark ${employee.firstName} ${employee.lastName} as Terminated? ` +
        `This keeps the record and payroll history; the row will move to the bottom of the roster.`,
    );
    if (!ok) return;
    setBusy('fire');
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/employees/${encodeURIComponent(employee.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'TERMINATED' }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Fire failed (${res.status}): ${text.slice(0, 200)}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fire failed.');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const ok = window.confirm(
      `Permanently delete ${employee.firstName} ${employee.lastName}? ` +
        `If they worked here and have payroll history, use "Fire" instead so the record stays.`,
    );
    if (!ok) return;
    setBusy('delete');
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/employees/${encodeURIComponent(employee.id)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Delete failed (${res.status}): ${text.slice(0, 200)}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <span className="flex items-center gap-3 text-xs">
      {employee.status !== 'TERMINATED' && (
        <button
          type="button"
          onClick={fire}
          disabled={busy !== null}
          className="font-medium text-amber-700 hover:underline disabled:opacity-50"
        >
          {busy === 'fire' ? 'Firing…' : 'Fire'}
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={busy !== null}
        className="font-medium text-red-700 hover:underline disabled:opacity-50"
      >
        {busy === 'delete' ? 'Deleting…' : 'Delete'}
      </button>
      {error && <span className="text-red-700">{error}</span>}
    </span>
  );
}
