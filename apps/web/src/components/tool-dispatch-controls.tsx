'use client';

// Tool dispatch controls — client island used inline in /tools rows.
//
// Two states:
//   - Tool is unassigned: shows a dropdown of active field employees and an
//     "Assign" button. Click triggers POST /api/tools/:id/dispatch.
//   - Tool is assigned: shows a "Return" button. Click triggers
//     POST /api/tools/:id/return (defaults to IN_YARD).
//
// After either action we router.refresh() so the parent server-component
// list page re-fetches and the new state shows everywhere.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { fullName, type Employee, type Tool } from '@yge/shared';
import { useTranslator } from '../lib/use-translator';

interface Props {
  tool: Tool;
  employees: Employee[];
  apiBaseUrl: string;
}

export function ToolDispatchControls({ tool, employees, apiBaseUrl }: Props) {
  const router = useRouter();
  const t = useTranslator();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string>(employees[0]?.id ?? '');

  async function dispatch() {
    if (!target) return;
    setError(null);
    const res = await fetch(`${apiBaseUrl}/api/tools/${tool.id}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedToEmployeeId: target }),
    });
    if (!res.ok) {
      setError(t('toolDispatch.errDispatch', { status: res.status }));
      return;
    }
    startTransition(() => router.refresh());
  }

  async function returnToYard(destination: 'IN_YARD' | 'IN_SHOP' | 'OUT_FOR_REPAIR') {
    setError(null);
    const res = await fetch(`${apiBaseUrl}/api/tools/${tool.id}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination }),
    });
    if (!res.ok) {
      setError(t('toolDispatch.errReturn', { status: res.status }));
      return;
    }
    startTransition(() => router.refresh());
  }

  if (tool.status === 'ASSIGNED') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => void returnToYard('IN_YARD')}
          disabled={pending}
          className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
        >
          {t('toolDispatch.returnYard')}
        </button>
        <button
          type="button"
          onClick={() => void returnToYard('OUT_FOR_REPAIR')}
          disabled={pending}
          className="rounded border border-orange-300 px-2 py-1 text-orange-700 hover:bg-orange-50 disabled:opacity-50"
        >
          {t('toolDispatch.sendRepair')}
        </button>
        {error && <span className="text-red-600">{error}</span>}
      </div>
    );
  }

  if (tool.status === 'RETIRED' || tool.status === 'LOST') {
    return (
      <span className="text-xs text-gray-400">
        {tool.status === 'RETIRED'
          ? t('toolDispatch.notDispatchableRetired')
          : t('toolDispatch.notDispatchableLost')}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1"
      >
        {employees.length === 0 && <option value="">{t('toolDispatch.noCrew')}</option>}
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {fullName(e)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={dispatch}
        disabled={pending || !target}
        className="rounded bg-yge-blue-500 px-2 py-1 font-medium text-white hover:bg-yge-blue-700 disabled:opacity-50"
      >
        {t('toolDispatch.assign')}
      </button>
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
