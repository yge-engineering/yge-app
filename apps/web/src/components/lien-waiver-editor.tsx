// Lien waiver editor — create + edit form for CA statutory waivers.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  dollarsToCents,
  isConditional,
  lienWaiverKindLabel,
  lienWaiverStatusLabel,
  type LienWaiver,
  type LienWaiverKind,
  type LienWaiverStatus,
} from '@yge/shared';

const KINDS: LienWaiverKind[] = [
  'CONDITIONAL_PROGRESS',
  'UNCONDITIONAL_PROGRESS',
  'CONDITIONAL_FINAL',
  'UNCONDITIONAL_FINAL',
];
const STATUSES: LienWaiverStatus[] = ['DRAFT', 'SIGNED', 'DELIVERED', 'VOIDED'];

interface FormState {
  jobId: string;
  arInvoiceId: string;
  arPaymentId: string;
  kind: LienWaiverKind;
  status: LienWaiverStatus;
  ownerName: string;
  jobName: string;
  jobAddress: string;
  claimantName: string;
  paymentAmountDollars: string;
  throughDate: string;
  disputedAmountDollars: string;
  disputedItems: string;
  signedOn: string;
  signedByName: string;
  signedByTitle: string;
  deliveredOn: string;
  notes: string;
}

function defaults(w?: LienWaiver): FormState {
  return {
    jobId: w?.jobId ?? '',
    arInvoiceId: w?.arInvoiceId ?? '',
    arPaymentId: w?.arPaymentId ?? '',
    kind: w?.kind ?? 'CONDITIONAL_PROGRESS',
    status: w?.status ?? 'DRAFT',
    ownerName: w?.ownerName ?? '',
    jobName: w?.jobName ?? '',
    jobAddress: w?.jobAddress ?? '',
    claimantName: w?.claimantName ?? 'Young General Engineering, Inc.',
    paymentAmountDollars: w?.paymentAmountCents ? (w.paymentAmountCents / 100).toFixed(2) : '',
    throughDate: w?.throughDate ?? '',
    disputedAmountDollars:
      w?.disputedAmountCents != null ? (w.disputedAmountCents / 100).toFixed(2) : '',
    disputedItems: w?.disputedItems ?? '',
    signedOn: w?.signedOn ?? '',
    signedByName: w?.signedByName ?? '',
    signedByTitle: w?.signedByTitle ?? '',
    deliveredOn: w?.deliveredOn ?? '',
    notes: w?.notes ?? '',
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function LienWaiverEditor({
  mode,
  waiver,
}: {
  mode: 'create' | 'edit';
  waiver?: LienWaiver;
}) {
  const router = useRouter();
  const t = useTranslator();
  const [form, setForm] = useState<FormState>(defaults(waiver));
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
      jobId: form.jobId.trim(),
      arInvoiceId: trim(form.arInvoiceId),
      arPaymentId: trim(form.arPaymentId),
      kind: form.kind,
      status: form.status,
      ownerName: form.ownerName.trim(),
      jobName: form.jobName.trim(),
      jobAddress: trim(form.jobAddress),
      claimantName: form.claimantName.trim(),
      paymentAmountCents: dollarsToCents(Number(form.paymentAmountDollars || 0)),
      throughDate: form.throughDate,
      disputedAmountCents:
        form.disputedAmountDollars.trim().length > 0
          ? dollarsToCents(Number(form.disputedAmountDollars))
          : undefined,
      disputedItems: trim(form.disputedItems),
      signedOn: trim(form.signedOn),
      signedByName: trim(form.signedByName),
      signedByTitle: trim(form.signedByTitle),
      deliveredOn: trim(form.deliveredOn),
      notes: trim(form.notes),
    };

    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/lien-waivers`
          : `${apiBaseUrl()}/api/lien-waivers/${waiver!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { waiver: LienWaiver };
      if (mode === 'create') {
        router.push(`/lien-waivers/${json.waiver.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const conditional = isConditional(form.kind);

  return (
    <form onSubmit={save} className="space-y-6">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!conditional && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          <strong>{t('lienWaiver.cautionLeader')}</strong>{t('lienWaiver.cautionBody')}
        </div>
      )}

      <Section title={t('lienWaiver.secForm')}>
        <Field label={t('lienWaiver.lblKind')}>
          <select
            className={inputCls}
            value={form.kind}
            onChange={(e) => setField('kind', e.target.value as LienWaiverKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {lienWaiverKindLabel(k)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('lienWaiver.lblStatus')}>
          <select
            className={inputCls}
            value={form.status}
            onChange={(e) => setField('status', e.target.value as LienWaiverStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {lienWaiverStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('lienWaiver.lblJobId')} required>
          <input
            className={inputCls}
            value={form.jobId}
            onChange={(e) => setField('jobId', e.target.value)}
            placeholder={t('lienWaiver.phJobId')}
            required
          />
        </Field>
        <Field label={t('lienWaiver.lblArInvId')}>
          <input
            className={inputCls}
            value={form.arInvoiceId}
            onChange={(e) => setField('arInvoiceId', e.target.value)}
            placeholder={t('lienWaiver.phArInvId')}
          />
        </Field>
        <Field label={t('lienWaiver.lblArPaymentId')}>
          <input
            className={inputCls}
            value={form.arPaymentId}
            onChange={(e) => setField('arPaymentId', e.target.value)}
            placeholder={t('lienWaiver.phArPaymentId')}
          />
        </Field>
      </Section>

      <Section title={t('lienWaiver.secHeader')}>
        <Field label={t('lienWaiver.lblOwner')} required>
          <input
            className={inputCls}
            value={form.ownerName}
            onChange={(e) => setField('ownerName', e.target.value)}
            required
          />
        </Field>
        <Field label={t('lienWaiver.lblClaimant')} required>
          <input
            className={inputCls}
            value={form.claimantName}
            onChange={(e) => setField('claimantName', e.target.value)}
            required
          />
        </Field>
        <Field label={t('lienWaiver.lblJobName')} required>
          <input
            className={inputCls}
            value={form.jobName}
            onChange={(e) => setField('jobName', e.target.value)}
            required
          />
        </Field>
        <Field label={t('lienWaiver.lblJobAddress')}>
          <input
            className={inputCls}
            value={form.jobAddress}
            onChange={(e) => setField('jobAddress', e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t('lienWaiver.secMoney')}>
        <Field label={t('lienWaiver.lblPaymentAmount')} required>
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls}
            value={form.paymentAmountDollars}
            onChange={(e) => setField('paymentAmountDollars', e.target.value)}
            required
          />
        </Field>
        <Field label={t('lienWaiver.lblThroughDate')} required>
          <input
            type="date"
            className={inputCls}
            value={form.throughDate}
            onChange={(e) => setField('throughDate', e.target.value)}
            required
          />
        </Field>
        <Field label={t('lienWaiver.lblDisputedAmount')}>
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputCls}
            value={form.disputedAmountDollars}
            onChange={(e) => setField('disputedAmountDollars', e.target.value)}
          />
        </Field>
        <Field label={t('lienWaiver.lblDisputedItems')}>
          <input
            className={inputCls}
            value={form.disputedItems}
            onChange={(e) => setField('disputedItems', e.target.value)}
            placeholder={t('lienWaiver.phDisputedItems')}
          />
        </Field>
      </Section>

      <Section title={t('lienWaiver.secSigning')}>
        <Field label={t('lienWaiver.lblSignedOn')}>
          <input
            type="date"
            className={inputCls}
            value={form.signedOn}
            onChange={(e) => setField('signedOn', e.target.value)}
          />
        </Field>
        <Field label={t('lienWaiver.lblSignedByName')}>
          <input
            className={inputCls}
            value={form.signedByName}
            onChange={(e) => setField('signedByName', e.target.value)}
          />
        </Field>
        <Field label={t('lienWaiver.lblSignedByTitle')}>
          <input
            className={inputCls}
            value={form.signedByTitle}
            onChange={(e) => setField('signedByTitle', e.target.value)}
            placeholder={t('lienWaiver.phSignedByTitle')}
          />
        </Field>
        <Field label={t('lienWaiver.lblDeliveredOn')}>
          <input
            type="date"
            className={inputCls}
            value={form.deliveredOn}
            onChange={(e) => setField('deliveredOn', e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t('lienWaiver.secNotes')}>
        <Field label={t('lienWaiver.lblNotes')} full>
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
          {saving ? t('lienWaiver.busy') : mode === 'create' ? t('lienWaiver.create') : t('lienWaiver.save')}
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
