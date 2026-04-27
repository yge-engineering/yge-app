// Vendor editor — create + edit form for vendor master records.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  vendorKindLabel,
  vendorPaymentTermsLabel,
  type Vendor,
  type VendorKind,
  type VendorPaymentTerms,
} from '@yge/shared';

const KINDS: VendorKind[] = [
  'SUPPLIER',
  'SUBCONTRACTOR',
  'EQUIPMENT_RENTAL',
  'TRUCKING',
  'PROFESSIONAL',
  'UTILITY',
  'GOVERNMENT',
  'OTHER',
];
const TERMS: VendorPaymentTerms[] = [
  'NET_30',
  'NET_60',
  'NET_45',
  'NET_15',
  'NET_10',
  'DUE_ON_RECEIPT',
  'COD',
  'PREPAID',
  'OTHER',
];

interface FormState {
  legalName: string;
  dbaName: string;
  kind: VendorKind;
  taxId: string;
  w9OnFile: boolean;
  w9CollectedOn: string;
  is1099Reportable: boolean;
  coiOnFile: boolean;
  coiExpiresOn: string;
  addressLine: string;
  city: string;
  state: string;
  zip: string;
  contactName: string;
  phone: string;
  email: string;
  paymentTerms: VendorPaymentTerms;
  accountNumber: string;
  defaultGlCode: string;
  cslbLicense: string;
  dirRegistration: string;
  onHold: boolean;
  onHoldReason: string;
  notes: string;
}

function defaults(v?: Vendor): FormState {
  return {
    legalName: v?.legalName ?? '',
    dbaName: v?.dbaName ?? '',
    kind: v?.kind ?? 'SUPPLIER',
    taxId: v?.taxId ?? '',
    w9OnFile: v?.w9OnFile ?? false,
    w9CollectedOn: v?.w9CollectedOn ?? '',
    is1099Reportable: v?.is1099Reportable ?? false,
    coiOnFile: v?.coiOnFile ?? false,
    coiExpiresOn: v?.coiExpiresOn ?? '',
    addressLine: v?.addressLine ?? '',
    city: v?.city ?? '',
    state: v?.state ?? '',
    zip: v?.zip ?? '',
    contactName: v?.contactName ?? '',
    phone: v?.phone ?? '',
    email: v?.email ?? '',
    paymentTerms: v?.paymentTerms ?? 'NET_30',
    accountNumber: v?.accountNumber ?? '',
    defaultGlCode: v?.defaultGlCode ?? '',
    cslbLicense: v?.cslbLicense ?? '',
    dirRegistration: v?.dirRegistration ?? '',
    onHold: v?.onHold ?? false,
    onHoldReason: v?.onHoldReason ?? '',
    notes: v?.notes ?? '',
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function VendorEditor({
  mode,
  vendor,
}: {
  mode: 'create' | 'edit';
  vendor?: Vendor;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaults(vendor));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Strip empty optional strings so Zod doesn't choke on regex-tagged fields.
    const trim = (s: string) => (s.trim().length === 0 ? undefined : s.trim());
    const body: Record<string, unknown> = {
      legalName: form.legalName.trim(),
      dbaName: trim(form.dbaName),
      kind: form.kind,
      taxId: trim(form.taxId),
      w9OnFile: form.w9OnFile,
      w9CollectedOn: trim(form.w9CollectedOn),
      is1099Reportable: form.is1099Reportable,
      coiOnFile: form.coiOnFile,
      coiExpiresOn: trim(form.coiExpiresOn),
      addressLine: trim(form.addressLine),
      city: trim(form.city),
      state: trim(form.state),
      zip: trim(form.zip),
      contactName: trim(form.contactName),
      phone: trim(form.phone),
      email: trim(form.email),
      paymentTerms: form.paymentTerms,
      accountNumber: trim(form.accountNumber),
      defaultGlCode: trim(form.defaultGlCode),
      cslbLicense: trim(form.cslbLicense),
      dirRegistration: trim(form.dirRegistration),
      onHold: form.onHold,
      onHoldReason: trim(form.onHoldReason),
      notes: trim(form.notes),
    };

    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/vendors`
          : `${apiBaseUrl()}/api/vendors/${vendor!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { vendor: Vendor };
      if (mode === 'create') {
        router.push(`/vendors/${json.vendor.id}`);
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

      <Section title="Identity">
        <Field label="Legal name" required>
          <input
            className={inputCls}
            value={form.legalName}
            onChange={(e) => setField('legalName', e.target.value)}
            required
          />
        </Field>
        <Field label="DBA / display name">
          <input
            className={inputCls}
            value={form.dbaName}
            onChange={(e) => setField('dbaName', e.target.value)}
          />
        </Field>
        <Field label="Kind">
          <select
            className={inputCls}
            value={form.kind}
            onChange={(e) => setField('kind', e.target.value as VendorKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {vendorKindLabel(k)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Payment terms">
          <select
            className={inputCls}
            value={form.paymentTerms}
            onChange={(e) =>
              setField('paymentTerms', e.target.value as VendorPaymentTerms)
            }
          >
            {TERMS.map((t) => (
              <option key={t} value={t}>
                {vendorPaymentTermsLabel(t)}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Tax + 1099">
        <Field label="Federal Tax ID (EIN or SSN)">
          <input
            className={inputCls}
            value={form.taxId}
            onChange={(e) => setField('taxId', e.target.value)}
            placeholder="12-3456789 or 123-45-6789"
          />
        </Field>
        <Field label="1099-NEC reportable">
          <Checkbox
            checked={form.is1099Reportable}
            onChange={(b) => setField('is1099Reportable', b)}
            label="Payments to this vendor count toward 1099-NEC"
          />
        </Field>
        <Field label="W-9 on file">
          <Checkbox
            checked={form.w9OnFile}
            onChange={(b) => setField('w9OnFile', b)}
            label="Current W-9 received"
          />
        </Field>
        <Field label="W-9 collected on">
          <input
            type="date"
            className={inputCls}
            value={form.w9CollectedOn}
            onChange={(e) => setField('w9CollectedOn', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Insurance + License (subs)">
        <Field label="COI on file">
          <Checkbox
            checked={form.coiOnFile}
            onChange={(b) => setField('coiOnFile', b)}
            label="Certificate of Insurance received"
          />
        </Field>
        <Field label="COI expires on">
          <input
            type="date"
            className={inputCls}
            value={form.coiExpiresOn}
            onChange={(e) => setField('coiExpiresOn', e.target.value)}
          />
        </Field>
        <Field label="CSLB license #">
          <input
            className={inputCls}
            value={form.cslbLicense}
            onChange={(e) => setField('cslbLicense', e.target.value)}
          />
        </Field>
        <Field label="DIR registration #">
          <input
            className={inputCls}
            value={form.dirRegistration}
            onChange={(e) => setField('dirRegistration', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Address">
        <Field label="Address line">
          <input
            className={inputCls}
            value={form.addressLine}
            onChange={(e) => setField('addressLine', e.target.value)}
          />
        </Field>
        <Field label="City">
          <input
            className={inputCls}
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
          />
        </Field>
        <Field label="State">
          <input
            className={inputCls}
            value={form.state}
            onChange={(e) => setField('state', e.target.value)}
          />
        </Field>
        <Field label="ZIP">
          <input
            className={inputCls}
            value={form.zip}
            onChange={(e) => setField('zip', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Contact">
        <Field label="Contact name">
          <input
            className={inputCls}
            value={form.contactName}
            onChange={(e) => setField('contactName', e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputCls}
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            className={inputCls}
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Accounting">
        <Field label="Account # (their side)">
          <input
            className={inputCls}
            value={form.accountNumber}
            onChange={(e) => setField('accountNumber', e.target.value)}
          />
        </Field>
        <Field label="Default GL code">
          <input
            className={inputCls}
            value={form.defaultGlCode}
            onChange={(e) => setField('defaultGlCode', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Status">
        <Field label="On hold">
          <Checkbox
            checked={form.onHold}
            onChange={(b) => setField('onHold', b)}
            label="Block payments to this vendor"
          />
        </Field>
        <Field label="On-hold reason">
          <input
            className={inputCls}
            value={form.onHoldReason}
            onChange={(e) => setField('onHoldReason', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Notes" full>
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
          {saving ? 'Saving…' : mode === 'create' ? 'Create vendor' : 'Save changes'}
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
