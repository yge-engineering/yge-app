'use client';

// EmployeeStatusEditor — small client island for the employee detail
// page that flips status (Active / On Leave / Laid Off / Terminated)
// via PATCH /api/employees/:id, then refreshes the page so the rest
// of the UI (status pill, list-page sort) reflects the change.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  employmentStatusLabel,
  type Employee,
  type EmploymentStatus,
} from '@yge/shared';

const STATUSES: EmploymentStatus[] = [
  'ACTIVE',
  'ON_LEAVE',
  'LAID_OFF',
  'TERMINATED',
];

interface Props {
  employee: Employee;
  apiBaseUrl: string;
}

export function EmployeeStatusEditor({ employee, apiBaseUrl }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<EmploymentStatus>(employee.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(next: EmploymentStatus) {
    if (next === status) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/employees/${encodeURIComponent(employee.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Status change failed (${res.status}): ${text.slice(0, 200)}`);
      }
      setStatus(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status change failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <label className="block text-xs">
        <span className="mb-1 block font-medium uppercase tracking-wide text-gray-500">
          Status
        </span>
        <select
          value={status}
          onChange={(e) => void changeStatus(e.target.value as EmploymentStatus)}
          disabled={busy}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm disabled:opacity-50"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {employmentStatusLabel(s)}
            </option>
          ))}
        </select>
      </label>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
