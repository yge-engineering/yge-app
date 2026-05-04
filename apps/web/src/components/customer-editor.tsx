// Customer editor — create + edit form.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  customerKindLabel,
  type Customer,
  type CustomerKind,
} from '@yge/shared';

const KINDS: CustomerKind[] = [
  'STATE_AGENCY',
  'FEDERAL_AGENCY',
  'COUNTY',
  'CITY',
  'SPECIAL_DISTRICT',
  'PRIVATE_OWNER',
  'PRIME_CONTRACTOR',
  'OTHER',
];

interface FormState {
  legalName: string;
  dbaName: string;
  kind: CustomerKind;
  contactName: string;
  contactTitle: string;
  phone: string;
  email: string;
  billingAddressLine: string;
  billingAddressLine2: string;
  city: string;
  state: string;
  zip: string;
  paymentTerms: string;
  ourAccountNumber: string;
  defaultRevenueAccount: string;
  taxExempt: boolean;
  taxExemptReason: string;
  onHold: boolean;
  onHoldReason: string;
  notes: string;
}

function defaults(c?: Customer): FormState {
  return {
    legalName: c?.legalName ?? '',
    dbaName: c?.dbaName ?? '',
    kind: c?.kind ?? 'STATE_AGENCY',
    contactName: c?.contactName ?? '',
    contactTitle: c?.contactTitle ?? '',
    phone: c?.phone ?? '',
    email: c?.email ?? '',
    billingAddressLine: c?.billingAddressLine ?? '',
    billingAddressLine2: c?.billingAddressLine2 ?? '',
    city: c?.city ?? '',
    state: c?.state ?? '',
    zip: c?.zip ?? '',
    paymentTerms: c?.paymentTerms ?? 'NET_30',
    ourAccountNumber: c?.ourAccountNumber ?? '',
    defaultRevenueAccount: c?.defaultRevenueAccount ?? '40100',
    taxExempt: c?.taxExempt ?? false,
    taxExemptReason: c?.taxExemptReason ?? '',
    onHold: c?.onHold ?? false,
    onHoldReason: c?.onHoldReason ?? '',
    notes: c?.notes ?? '',
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function CustomerEditor({
  mode,
  customer,
}: {
  mode: 'create' | 'edit';
  customer?: Customer;
}) {
  const router = useRouter();
  const t = useTranslator();
  const [form, setForm] = useState<FormState>(defaults(customer));
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
      legalName: form.legalName.trim(),
      dbaName: trim(form.dbaName),
      kind: form.kind,
      contactName: trim(form.contactName),
      contactTitle: trim(form.contactTitle),
      phone: trim(form.phone),
      email: trim(form.email),
      billingAddressLine: trim(form.billingAddressLine),
      billingAddressLine2: trim(form.billingAddressLine2),
      city: trim(form.city),
      state: trim(form.state),
      zip: trim(form.zip),
      paymentTerms: trim(form.paymentTerms),
      ourAccountNumber: trim(form.ourAccountNumber),
      defaultRevenueAccount: trim(form.defaultRevenueAccount),
      taxExempt: form.taxExempt,
      taxExemptReason: trim(form.taxExemptReason),
      onHold: form.onHold,
      onHoldReason: trim(form.onHoldReason),
      notes: trim(form.notes),
    };
    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/customers`
          : `${apiBaseUrl()}/api/customers/${customer!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { customer: Customer };
      if (mode === 'create') {
        router.push(`/customers/${json.customer.id}`);
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

      <Section title={t('customerEditor.secIdentity')}>
        <Field label={t('customerEditor.lblLegalName')} required>
          <input
            className={inputCls}
            value={form.legalName}
            onChange={(e) => setField('legalName', e.target.value)}
            required
          />
        </Field>
        <Field label={t('customerEditor.lblDba')}>
          <input
            className={inputCls}
            value={form.dbaName}
            onChange={(e) => setField('dbaName', e.target.value)}
          />
        </Field>
        <Field label={t('customerEditor.lblKind')}>
          <select
            className={inputCls}
            value={form.kind}
            onChange={(e) => setField('kind', e.target.value as CustomerKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {customerKindLabel(k)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('customerEditor.lblPaymentTerms')}>
          <input
            className={inputCls}
            value={form.paymentTerms}
            onChange={(e) => setField('paymentTerms', e.target.value)}
            placeholder={t('customerEditor.phPaymentTerms')}
          />
        </Field>
      </Section>

      <Section title={t('customerEditor.secContact')}>
        <Field label={t('customerEditor.lblContactName')}>
          <input
            className={inputCls}
            value={form.contactName}
            onChange={(e) => setField('contactName', e.target.value)}
          />
        </Field>
        <Field label={t('customerEditor.lblContactTitle')}>
          <input
            className={inputCls}
            value={form.contactTitle}
            onChange={(e) => setField('contactTitle', e.target.value)}
          />
        </Field>
        <Field label={t('customerEditor.lblPhone')}>
          <input
            className={inputCls}
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
          />
        </Field>
        <Field label={t('customerEditor.lblEmail')}>
          <input
            className={inputCls}
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t('customerEditor.secBilling')}>
        <Field label={t('customerEditor.lblAddrLine1')} full>
          <input
            className={inputCls}
            value={form.billingAddressLine}
            onChange={(e) => setField('billingAddressLine', e.target.value)}
          />
        </Field>
        <Field label={t('customerEditor.lblAddrLine2')} full>
          <input
            className={inputCls}
            value={form.billingAddressLine2}
            onChange={(e) => setField('billingAddressLine2', e.target.value)}
          />
        </Field>
        <Field label={t('customerEditor.lblCity')}>
          <input
            className={inputCls}
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
          />
        </Field>
        <Field label={t('customerEditor.lblState')}>
          <input
            className={inputCls}
            value={form.state}
            onChange={(e) => setField('state', e.target.value)}
          />
        </Field>
        <Field label={t('customerEditor.lblZip')}>
          <input
            className={inputCls}
            value={form.zip}
            onChange={(e) => setField('zip', e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t('customerEditor.secAccounting')}>
        <Field label={t('customerEditor.lblOurAcct')}>
          <input
            className={inputCls}
            value={form.ourAccountNumber}
            onChange={(e) => setField('ourAccountNumber', e.target.value)}
          />
        </Field>
        <Field label={t('customerEditor.lblDefaultRev')}>
          <input
            className={inputCls}
            value={form.defaultRevenueAccount}
            onChange={(e) => setField('defaultRevenueAccount', e.target.value)}
            placeholder={t('customerEditor.phDefaultRev')}
          />
        </Field>
        <Field label={t('customerEditor.lblTaxExempt')}>
          <Checkbox
            checked={form.taxExempt}
            onChange={(b) => setField('taxExempt', b)}
            label={t('customerEditor.cbTaxExempt')}
          />
        </Field>
        <Field label={t('customerEditor.lblTaxExemptReason')}>
          <input
            className={inputCls}
            value={form.taxExemptReason}
            onChange={(e) => setField('taxExemptReason', e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t('customerEditor.secStatus')}>
        <Field label={t('customerEditor.lblOnHold')}>
          <Checkbox
            checked={form.onHold}
            onChange={(b) => setField('onHold', b)}
            label={t('customerEditor.cbOnHold')}
          />
        </Field>
        <Field label={t('customerEditor.lblOnHoldReason')}>
          <input
            className={inputCls}
            value={form.onHoldReason}
            onChange={(e) => setField('onHoldReason', e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t('customerEditor.secNotes')}>
        <Field label={t('customerEditor.lblNotes')} full>
          <textarea
            className={`${inputCls} min-h-[100px]`}
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
          {saving ? t('customerEditor.busy') : mode === 'create' ? t('customerEditor.create') : t('customerEditor.save')}
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
