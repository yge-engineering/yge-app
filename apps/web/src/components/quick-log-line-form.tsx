// Quick "log a line" form — mobile-friendly inline cost entry. Posts
// straight into today's DailyReport for the given job.

'use client';

import { useState } from 'react';
import { CostCodePicker } from './cost-code-picker';
import { useRouter } from 'next/navigation';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function QuickLogLineForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [reportDate, setReportDate] = useState(today);
  const [category, setCategory] = useState('Labor');
  const [costCode, setCostCode] = useState('');
  const [description, setDescription] = useState('');
  const [qtyHrs, setQtyHrs] = useState('');
  const [unit, setUnit] = useState('hr');
  const [rateDollars, setRateDollars] = useState('');
  const [employeeVendor, setEmployeeVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const qty = Number(qtyHrs);
      const rateCents = Math.round(Number(rateDollars) * 100);
      const totalCostCents = Math.round((qty || 0) * (rateCents || 0));
      const res = await fetch(`${apiBaseUrl()}/api/imported-daily-reports/quick-log`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobId,
          reportDate,
          category,
          costCode: costCode.trim() || undefined,
          description: description.trim() || undefined,
          qtyHrs: Number.isFinite(qty) ? qty : 0,
          unit: unit.trim() || undefined,
          rateCents: Number.isFinite(rateCents) ? rateCents : 0,
          totalCostCents,
          employeeVendor: employeeVendor.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { lineCount: number };
      setMsg(`Saved — report now has ${body.lineCount} line${body.lineCount === 1 ? '' : 's'}.`);
      // Reset partial fields for the next entry.
      setCostCode('');
      setDescription('');
      setQtyHrs('');
      setRateDollars('');
      setEmployeeVendor('');
      setNotes('');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Quick-log a cost line</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700">Date</span>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option>Labor</option>
            <option>Material</option>
            <option>Equipment (Owned)</option>
            <option>Equipment (Rental)</option>
            <option>Subcontract</option>
            <option>Other</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700">Cost code</span>
          <CostCodePicker
            value={costCode}
            rateType="PW"
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-sm"
            onPick={(r) => {
              if (!r.found) return;
              setCostCode(r.code);
              if (!description.trim()) setDescription(r.name);
              if (!unit.trim() || unit === 'hr') setUnit(r.unit);
              if (!rateDollars.trim() || rateDollars === '0') {
                setRateDollars((r.unitCostCents / 100).toFixed(2));
              }
            }}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700">Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700">Qty / Hrs</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.25"
            value={qtyHrs}
            onChange={(e) => setQtyHrs(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700">Unit</span>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700">Rate ($)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={rateDollars}
            onChange={(e) => setRateDollars(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-700">Employee / Vendor</span>
          <input
            value={employeeVendor}
            onChange={(e) => setEmployeeVendor(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-xs font-semibold text-gray-700">Notes</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      {error && (
        <p className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </p>
      )}
      {msg && (
        <p className="mt-3 rounded border border-green-300 bg-green-50 p-2 text-xs text-green-800">
          {msg}
        </p>
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-yge-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Log line'}
        </button>
      </div>
    </form>
  );
}
