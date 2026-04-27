// Bank reconciliation editor.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  adjustmentKindLabel,
  bankRecStatusLabel,
  computeBankRec,
  dollarsToCents,
  formatUSD,
  signedAdjustmentNetCents,
  type BankRec,
  type BankRecAdjustment,
  type BankRecAdjustmentKind,
  type BankRecStatus,
} from '@yge/shared';

const STATUSES: BankRecStatus[] = ['DRAFT', 'RECONCILED', 'VOIDED'];
const ADJ_KINDS: BankRecAdjustmentKind[] = ['BANK_FEE', 'INTEREST', 'MANUAL'];

interface FormState {
  bankAccountLabel: string;
  glAccountNumber: string;
  statementDate: string;
  beginningBalanceDollars: string;
  statementBalanceDollars: string;
  glBalanceDollars: string;
  outstandingChecksDollars: string;
  outstandingDepositsDollars: string;
  status: BankRecStatus;
  reconciledOn: string;
  reconciledByName: string;
  notes: string;
  adjustments: BankRecAdjustment[];
}

function defaults(r?: BankRec): FormState {
  return {
    bankAccountLabel: r?.bankAccountLabel ?? 'Operating',
    glAccountNumber: r?.glAccountNumber ?? '10100',
    statementDate: r?.statementDate ?? new Date().toISOString().slice(0, 10),
    beginningBalanceDollars: r?.beginningBalanceCents != null ? (r.beginningBalanceCents / 100).toFixed(2) : '0.00',
    statementBalanceDollars: r?.statementBalanceCents != null ? (r.statementBalanceCents / 100).toFixed(2) : '0.00',
    glBalanceDollars: r?.glBalanceCents != null ? (r.glBalanceCents / 100).toFixed(2) : '0.00',
    outstandingChecksDollars: r?.outstandingChecksCents != null ? (r.outstandingChecksCents / 100).toFixed(2) : '0.00',
    outstandingDepositsDollars: r?.outstandingDepositsCents != null ? (r.outstandingDepositsCents / 100).toFixed(2) : '0.00',
    status: r?.status ?? 'DRAFT',
    reconciledOn: r?.reconciledOn ?? '',
    reconciledByName: r?.reconciledByName ?? 'Ryan D. Young',
    notes: r?.notes ?? '',
    adjustments: r?.adjustments ?? [],
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function BankRecEditor({
  mode,
  rec,
}: {
  mode: 'create' | 'edit';
  rec?: BankRec;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaults(rec));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function addAdjustment() {
    setField('adjustments', [
      ...form.adjustments,
      { kind: 'BANK_FEE', description: '', amountCents: 0 },
    ]);
  }
  function updateAdjustment(i: number, patch: Partial<BankRecAdjustment>) {
    setField(
      'adjustments',
      form.adjustments.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    );
  }
  function removeAdjustment(i: number) {
    setField('adjustments', form.adjustments.filter((_, idx) => idx !== i));
  }

  // Live reconciliation preview.
  const cents = (s: string) => dollarsToCents(Number(s) || 0);
  const preview = computeBankRec({
    statementBalanceCents: cents(form.statementBalanceDollars),
    outstandingChecksCents: cents(form.outstandingChecksDollars),
    outstandingDepositsCents: cents(form.outstandingDepositsDollars),
    glBalanceCents: cents(form.glBalanceDollars),
    adjustments: form.adjustments,
  });
  const adjustmentNet = signedAdjustmentNetCents(form.adjustments);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const trim = (s: string) => (s.trim().length === 0 ? undefined : s.trim());
    const body: Record<string, unknown> = {
      bankAccountLabel: form.bankAccountLabel.trim(),
      glAccountNumber: trim(form.glAccountNumber),
      statementDate: form.statementDate,
      beginningBalanceCents: cents(form.beginningBalanceDollars),
      statementBalanceCents: cents(form.statementBalanceDollars),
      glBalanceCents: cents(form.glBalanceDollars),
      outstandingChecksCents: cents(form.outstandingChecksDollars),
      outstandingDepositsCents: cents(form.outstandingDepositsDollars),
      status: form.status,
      reconciledOn: trim(form.reconciledOn),
      reconciledByName: trim(form.reconciledByName),
      notes: trim(form.notes),
      adjustments: form.adjustments
        .filter((a) => a.description.trim().length > 0)
        .map((a) => ({
          ...a,
          description: a.description.trim(),
        })),
    };

    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/bank-recs`
          : `${apiBaseUrl()}/api/bank-recs/${rec!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { rec: BankRec };
      if (mode === 'create') {
        router.push(`/bank-recs/${json.rec.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div
        className={`rounded-lg border p-3 text-sm ${
          preview.inBalance
            ? 'border-green-300 bg-green-50 text-green-900'
            : 'border-yellow-300 bg-yellow-50 text-yellow-900'
        }`}
      >
        <strong>{preview.inBalance ? '✓ Reconciles' : '✗ Does not reconcile'}</strong>{' '}
        Adjusted bank {formatUSD(preview.adjustedBankBalanceCents)} ·
        Adjusted GL {formatUSD(preview.adjustedGlBalanceCents)}
        {!preview.inBalance && (
          <span> (Δ {formatUSD(preview.imbalanceCents)})</span>
        )}
      </div>

      <Section title="Account + period">
        <Field label="Bank account label" required>
          <input
            className={inputCls}
            value={form.bankAccountLabel}
            onChange={(e) => setField('bankAccountLabel', e.target.value)}
            placeholder="Operating - BoA x1234"
            required
          />
        </Field>
        <Field label="GL account number">
          <input
            className={inputCls}
            value={form.glAccountNumber}
            onChange={(e) => setField('glAccountNumber', e.target.value)}
            placeholder="10100"
          />
        </Field>
        <Field label="Statement date" required>
          <input
            type="date"
            className={inputCls}
            value={form.statementDate}
            onChange={(e) => setField('statementDate', e.target.value)}
            required
          />
        </Field>
        <Field label="Status">
          <select
            className={inputCls}
            value={form.status}
            onChange={(e) => setField('status', e.target.value as BankRecStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {bankRecStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Balances">
        <Field label="Beginning balance ($)">
          <input
            type="number"
            step="0.01"
            className={inputCls}
            value={form.beginningBalanceDollars}
            onChange={(e) => setField('beginningBalanceDollars', e.target.value)}
          />
        </Field>
        <Field label="Statement (ending) balance ($)" required>
          <input
            type="number"
            step="0.01"
            className={inputCls}
            value={form.statementBalanceDollars}
            onChange={(e) => setField('statementBalanceDollars', e.target.value)}
            required
          />
        </Field>
        <Field label="GL balance per books ($)" required>
          <input
            type="number"
            step="0.01"
            className={inputCls}
            value={form.glBalanceDollars}
            onChange={(e) => setField('glBalanceDollars', e.target.value)}
            required
          />
        </Field>
      </Section>

      <Section title="In-transit items">
        <Field label="Outstanding checks ($)">
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls}
            value={form.outstandingChecksDollars}
            onChange={(e) => setField('outstandingChecksDollars', e.target.value)}
          />
        </Field>
        <Field label="Deposits in transit ($)">
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls}
            value={form.outstandingDepositsDollars}
            onChange={(e) => setField('outstandingDepositsDollars', e.target.value)}
          />
        </Field>
      </Section>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Adjustments ({form.adjustments.length}) · net{' '}
            <span className="font-mono">{formatUSD(adjustmentNet)}</span>
          </h2>
          <button
            type="button"
            onClick={addAdjustment}
            className="rounded border border-yge-blue-500 px-2 py-1 text-xs text-yge-blue-500 hover:bg-yge-blue-50"
          >
            + Add adjustment
          </button>
        </div>
        {form.adjustments.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">
            None. Add bank fees (subtract from GL), interest income (add to
            GL), or manual rounding adjustments.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {form.adjustments.map((a, i) => (
              <div key={i} className="grid gap-2 rounded border border-gray-200 p-2 sm:grid-cols-5">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Kind</label>
                  <select
                    className={inputCls}
                    value={a.kind}
                    onChange={(e) =>
                      updateAdjustment(i, { kind: e.target.value as BankRecAdjustmentKind })
                    }
                  >
                    {ADJ_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {adjustmentKindLabel(k)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-gray-700">Description</label>
                  <input
                    className={inputCls}
                    value={a.description}
                    onChange={(e) => updateAdjustment(i, { description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Amount ($)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      className={inputCls}
                      value={(a.amountCents / 100).toFixed(2)}
                      onChange={(e) =>
                        updateAdjustment(i, {
                          amountCents: dollarsToCents(Number(e.target.value) || 0),
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeAdjustment(i)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Section title="Sign-off">
        <Field label="Reconciled on">
          <input
            type="date"
            className={inputCls}
            value={form.reconciledOn}
            onChange={(e) => setField('reconciledOn', e.target.value)}
          />
        </Field>
        <Field label="Reconciled by">
          <input
            className={inputCls}
            value={form.reconciledByName}
            onChange={(e) => setField('reconciledByName', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Notes" full>
          <textarea
            className={`${inputCls} min-h-[80px]`}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : mode === 'create' ? 'Create rec' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  'w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-sm ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
