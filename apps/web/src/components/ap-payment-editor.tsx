// AP payment editor — outgoing payment to a vendor.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  apPaymentMethodLabel,
  dollarsToCents,
  type ApPayment,
  type ApPaymentMethod,
} from '@yge/shared';

const METHODS: ApPaymentMethod[] = ['CHECK', 'ACH', 'WIRE', 'CREDIT_CARD', 'CASH', 'OTHER'];

interface FormState {
  apInvoiceId: string;
  vendorName: string;
  method: ApPaymentMethod;
  paidOn: string;
  amountDollars: string;
  referenceNumber: string;
  bankAccount: string;
  cleared: boolean;
  clearedOn: string;
  voided: boolean;
  voidedOn: string;
  notes: string;
}

function defaults(p?: ApPayment): FormState {
  return {
    apInvoiceId: p?.apInvoiceId ?? '',
    vendorName: p?.vendorName ?? '',
    method: p?.method ?? 'CHECK',
    paidOn: p?.paidOn ?? new Date().toISOString().slice(0, 10),
    amountDollars: p?.amountCents ? (p.amountCents / 100).toFixed(2) : '',
    referenceNumber: p?.referenceNumber ?? '',
    bankAccount: p?.bankAccount ?? 'Operating',
    cleared: p?.cleared ?? false,
    clearedOn: p?.clearedOn ?? '',
    voided: p?.voided ?? false,
    voidedOn: p?.voidedOn ?? '',
    notes: p?.notes ?? '',
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function ApPaymentEditor({
  mode,
  payment,
}: {
  mode: 'create' | 'edit';
  payment?: ApPayment;
}) {
  const router = useRouter();
  const t = useTranslator();
  const [form, setForm] = useState<FormState>(defaults(payment));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const trim = (s: string) => (s.trim().length === 0 ? undefined : s.trim());
    const body: Record<string, unknown> = {
      apInvoiceId: form.apInvoiceId.trim(),
      vendorName: form.vendorName.trim(),
      method: form.method,
      paidOn: form.paidOn,
      amountCents: dollarsToCents(Number(form.amountDollars || 0)),
      referenceNumber: trim(form.referenceNumber),
      bankAccount: trim(form.bankAccount),
      cleared: form.cleared,
      clearedOn: trim(form.clearedOn),
      voided: form.voided,
      voidedOn: trim(form.voidedOn),
      notes: trim(form.notes),
    };

    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/ap-payments`
          : `${apiBaseUrl()}/api/ap-payments/${payment!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { payment: ApPayment };
      if (mode === 'create') {
        router.push(`/ap-payments/${json.payment.id}`);
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

      <Section title={t('apPayment.secInvoice')}>
        <Field label={t('apPayment.lblApInvId')} required>
          <input
            className={inputCls}
            value={form.apInvoiceId}
            onChange={(e) => setField('apInvoiceId', e.target.value)}
            placeholder={t('apPayment.phApInvId')}
            required
          />
        </Field>
        <Field label={t('apPayment.lblVendor')} required>
          <input
            className={inputCls}
            value={form.vendorName}
            onChange={(e) => setField('vendorName', e.target.value)}
            required
          />
        </Field>
      </Section>

      <Section title={t('apPayment.secPayment')}>
        <Field label={t('apPayment.lblMethod')}>
          <select
            className={inputCls}
            value={form.method}
            onChange={(e) => setField('method', e.target.value as ApPaymentMethod)}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {apPaymentMethodLabel(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('apPayment.lblPaidOn')} required>
          <input
            type="date"
            className={inputCls}
            value={form.paidOn}
            onChange={(e) => setField('paidOn', e.target.value)}
            required
          />
        </Field>
        <Field label={t('apPayment.lblAmount')} required>
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
        <Field label={t('apPayment.lblRefNum')}>
          <input
            className={inputCls}
            value={form.referenceNumber}
            onChange={(e) => setField('referenceNumber', e.target.value)}
            placeholder={t('apPayment.phRefNum')}
          />
        </Field>
        <Field label={t('apPayment.lblBank')}>
          <input
            className={inputCls}
            value={form.bankAccount}
            onChange={(e) => setField('bankAccount', e.target.value)}
            placeholder={t('apPayment.phBank')}
          />
        </Field>
      </Section>

      <Section title={t('apPayment.secStatus')}>
        <Field label={t('apPayment.lblCleared')}>
          <Checkbox
            checked={form.cleared}
            onChange={(b) => setField('cleared', b)}
            label={t('apPayment.cbCleared')}
          />
        </Field>
        <Field label={t('apPayment.lblClearedOn')}>
          <input
            type="date"
            className={inputCls}
            value={form.clearedOn}
            onChange={(e) => setField('clearedOn', e.target.value)}
          />
        </Field>
        <Field label={t('apPayment.lblVoided')}>
          <Checkbox
            checked={form.voided}
            onChange={(b) => setField('voided', b)}
            label={t('apPayment.cbVoided')}
          />
        </Field>
        <Field label={t('apPayment.lblVoidedOn')}>
          <input
            type="date"
            className={inputCls}
            value={form.voidedOn}
            onChange={(e) => setField('voidedOn', e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t('apPayment.secNotes')}>
        <Field label={t('apPayment.lblNotes')} full>
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
          {saving ? t('apPayment.busy') : mode === 'create' ? t('apPayment.create') : t('apPayment.save')}
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
