// Expense reimbursement editor.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  defaultGlAccountForCategory,
  dollarsToCents,
  expenseCategoryLabel,
  type Expense,
  type ExpenseCategory,
} from '@yge/shared';

const CATEGORIES: ExpenseCategory[] = [
  'MEAL',
  'PER_DIEM',
  'LODGING',
  'FUEL',
  'PARKING',
  'TOLLS',
  'MATERIAL',
  'TOOL_PURCHASE',
  'PERMIT_FEE',
  'TRAINING_FEE',
  'AGENCY_FEE',
  'OFFICE_SUPPLIES',
  'OTHER',
];

interface FormState {
  employeeId: string;
  employeeName: string;
  receiptDate: string;
  vendor: string;
  description: string;
  amountDollars: string;
  category: ExpenseCategory;
  jobId: string;
  glAccountNumber: string;
  receiptRef: string;
  paidWithCompanyCard: boolean;
  reimbursed: boolean;
  reimbursedOn: string;
  notes: string;
}

function defaults(e?: Expense): FormState {
  return {
    employeeId: e?.employeeId ?? '',
    employeeName: e?.employeeName ?? '',
    receiptDate: e?.receiptDate ?? new Date().toISOString().slice(0, 10),
    vendor: e?.vendor ?? '',
    description: e?.description ?? '',
    amountDollars: e?.amountCents ? (e.amountCents / 100).toFixed(2) : '',
    category: e?.category ?? 'OTHER',
    jobId: e?.jobId ?? '',
    glAccountNumber: e?.glAccountNumber ?? defaultGlAccountForCategory(e?.category ?? 'OTHER'),
    receiptRef: e?.receiptRef ?? '',
    paidWithCompanyCard: e?.paidWithCompanyCard ?? false,
    reimbursed: e?.reimbursed ?? false,
    reimbursedOn: e?.reimbursedOn ?? '',
    notes: e?.notes ?? '',
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function ExpenseEditor({
  mode,
  expense,
}: {
  mode: 'create' | 'edit';
  expense?: Expense;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaults(expense));
  const [glManual, setGlManual] = useState(mode === 'edit' && !!expense?.glAccountNumber);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function onCategoryChange(c: ExpenseCategory) {
    setForm((f) => ({
      ...f,
      category: c,
      glAccountNumber: glManual ? f.glAccountNumber : defaultGlAccountForCategory(c),
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const trim = (s: string) => (s.trim().length === 0 ? undefined : s.trim());
    const body: Record<string, unknown> = {
      employeeId: form.employeeId.trim(),
      employeeName: form.employeeName.trim(),
      receiptDate: form.receiptDate,
      vendor: form.vendor.trim(),
      description: form.description.trim(),
      amountCents: dollarsToCents(Number(form.amountDollars || 0)),
      category: form.category,
      jobId: trim(form.jobId),
      glAccountNumber: trim(form.glAccountNumber),
      receiptRef: trim(form.receiptRef),
      paidWithCompanyCard: form.paidWithCompanyCard,
      reimbursed: form.reimbursed,
      reimbursedOn: trim(form.reimbursedOn),
      notes: trim(form.notes),
    };
    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/expenses`
          : `${apiBaseUrl()}/api/expenses/${expense!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { expense: Expense };
      if (mode === 'create') {
        router.push(`/expenses/${json.expense.id}`);
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

      {form.paidWithCompanyCard && (
        <div className="rounded border border-purple-300 bg-purple-50 p-3 text-sm text-purple-900">
          <strong>Company card:</strong> this receipt is informational. The
          actual cash flow goes through the AP invoice on the card vendor's
          monthly statement; not reimbursable to the employee.
        </div>
      )}

      <Section title="Employee + receipt">
        <Field label="Employee ID" required>
          <input
            className={inputCls}
            value={form.employeeId}
            onChange={(e) => setField('employeeId', e.target.value)}
            placeholder="emp-xxxxxxxx"
            required
          />
        </Field>
        <Field label="Employee name" required>
          <input
            className={inputCls}
            value={form.employeeName}
            onChange={(e) => setField('employeeName', e.target.value)}
            required
          />
        </Field>
        <Field label="Receipt date" required>
          <input
            type="date"
            className={inputCls}
            value={form.receiptDate}
            onChange={(e) => setField('receiptDate', e.target.value)}
            required
          />
        </Field>
        <Field label="Amount ($)" required>
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls}
            value={form.amountDollars}
            onChange={(e) => setField('amountDollars', e.target.value)}
            required
          />
        </Field>
        <Field label="Vendor / merchant" required>
          <input
            className={inputCls}
            value={form.vendor}
            onChange={(e) => setField('vendor', e.target.value)}
            placeholder="Holiday Inn Redding"
            required
          />
        </Field>
        <Field label="Description" required>
          <input
            className={inputCls}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="2 nights — Sulphur Springs trip"
            required
          />
        </Field>
      </Section>

      <Section title="Coding">
        <Field label="Category">
          <select
            className={inputCls}
            value={form.category}
            onChange={(e) => onCategoryChange(e.target.value as ExpenseCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {expenseCategoryLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="GL account #">
          <input
            className={inputCls}
            value={form.glAccountNumber}
            onChange={(e) => {
              setGlManual(true);
              setField('glAccountNumber', e.target.value);
            }}
          />
        </Field>
        <Field label="Job ID">
          <input
            className={inputCls}
            value={form.jobId}
            onChange={(e) => setField('jobId', e.target.value)}
            placeholder="job-YYYY-MM-DD-..."
          />
        </Field>
        <Field label="Paid with company card?">
          <Checkbox
            checked={form.paidWithCompanyCard}
            onChange={(b) => setField('paidWithCompanyCard', b)}
            label="Excludes from employee reimbursement"
          />
        </Field>
      </Section>

      <Section title="Receipt file">
        <Field label="Receipt reference (filename / URL)" full>
          <input
            className={inputCls}
            value={form.receiptRef}
            onChange={(e) => setField('receiptRef', e.target.value)}
            placeholder="receipt_2026-04-15_holiday-inn.pdf"
          />
        </Field>
      </Section>

      <Section title="Reimbursement">
        <Field label="Reimbursed">
          <Checkbox
            checked={form.reimbursed}
            onChange={(b) => setField('reimbursed', b)}
            label="Already paid back to employee"
          />
        </Field>
        <Field label="Reimbursed on">
          <input
            type="date"
            className={inputCls}
            value={form.reimbursedOn}
            onChange={(e) => setField('reimbursedOn', e.target.value)}
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
          {saving ? 'Saving…' : mode === 'create' ? 'Log expense' : 'Save changes'}
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

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-yge-blue-500 focus:ring-yge-blue-500"
      />
      {label}
    </label>
  );
}
