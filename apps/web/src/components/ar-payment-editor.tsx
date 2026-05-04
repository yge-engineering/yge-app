// AR payment editor — create + edit form for customer receipts.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  arPaymentKindLabel,
  arPaymentMethodLabel,
  ca7107RetentionInterest,
  dollarsToCents,
  formatUSD,
  type ArPayment,
  type ArPaymentKind,
  type ArPaymentMethod,
} from '@yge/shared';

const KINDS: ArPaymentKind[] = [
  'PROGRESS',
  'RETENTION_RELEASE',
  'FINAL',
  'PARTIAL',
  'OTHER',
];
const METHODS: ArPaymentMethod[] = ['ACH', 'CHECK', 'WIRE', 'CARD', 'CASH', 'OTHER'];

interface FormState {
  arInvoiceId: string;
  jobId: string;
  kind: ArPaymentKind;
  method: ArPaymentMethod;
  receivedOn: string;
  amountDollars: string;
  referenceNumber: string;
  depositAccount: string;
  depositedOn: string;
  payerName: string;
  notes: string;
  /** Retention release scenario inputs (UI only). */
  retentionCompletedOn: string;
  retentionHeldDollars: string;
}

function defaults(p?: ArPayment): FormState {
  return {
    arInvoiceId: p?.arInvoiceId ?? '',
    jobId: p?.jobId ?? '',
    kind: p?.kind ?? 'PROGRESS',
    method: p?.method ?? 'CHECK',
    receivedOn: p?.receivedOn ?? new Date().toISOString().slice(0, 10),
    amountDollars: p?.amountCents ? (p.amountCents / 100).toFixed(2) : '',
    referenceNumber: p?.referenceNumber ?? '',
    depositAccount: p?.depositAccount ?? '',
    depositedOn: p?.depositedOn ?? '',
    payerName: p?.payerName ?? '',
    notes: p?.notes ?? '',
    retentionCompletedOn: '',
    retentionHeldDollars: '',
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function ArPaymentEditor({
  mode,
  payment,
}: {
  mode: 'create' | 'edit';
  payment?: ArPayment;
}) {
  const router = useRouter();
  const t = useTranslator();
  const [form, setForm] = useState<FormState>(defaults(payment));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  // §7107 retention interest preview (when kind=RETENTION_RELEASE).
  let interestPreview: { dueOn: string; daysLate: number; interestCents: number } | null = null;
  if (
    form.kind === 'RETENTION_RELEASE' &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.retentionCompletedOn) &&
    Number(form.retentionHeldDollars) > 0
  ) {
    interestPreview = ca7107RetentionInterest({
      completedOn: form.retentionCompletedOn,
      releasedOn: form.receivedOn || undefined,
      retentionHeldCents: dollarsToCents(Number(form.retentionHeldDollars)),
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const trim = (s: string) => (s.trim().length === 0 ? undefined : s.trim());
    const body: Record<string, unknown> = {
      arInvoiceId: form.arInvoiceId.trim(),
      jobId: form.jobId.trim(),
      kind: form.kind,
      method: form.method,
      receivedOn: form.receivedOn,
      amountCents: dollarsToCents(Number(form.amountDollars || 0)),
      referenceNumber: trim(form.referenceNumber),
      depositAccount: trim(form.depositAccount),
      depositedOn: trim(form.depositedOn),
      payerName: trim(form.payerName),
      notes: trim(form.notes),
    };

    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/ar-payments`
          : `${apiBaseUrl()}/api/ar-payments/${payment!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { payment: ArPayment };
      if (mode === 'create') {
        router.push(`/ar-payments/${json.payment.id}`);
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

      <Section title={t('arPayment.secInvoice')}>
        <Field label={t('arPayment.lblArInvId')} required>
          <input
            className={inputCls}
            value={form.arInvoiceId}
            onChange={(e) => setField('arInvoiceId', e.target.value)}
            placeholder={t('arPayment.phArInvId')}
            required
          />
        </Field>
        <Field label={t('arPayment.lblJobId')} required>
          <input
            className={inputCls}
            value={form.jobId}
            onChange={(e) => setField('jobId', e.target.value)}
            placeholder={t('arPayment.phJobId')}
            required
          />
        </Field>
      </Section>

      <Section title={t('arPayment.secPayment')}>
        <Field label={t('arPayment.lblKind')}>
          <select
            className={inputCls}
            value={form.kind}
            onChange={(e) => setField('kind', e.target.value as ArPaymentKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {arPaymentKindLabel(k)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('arPayment.lblMethod')}>
          <select
            className={inputCls}
            value={form.method}
            onChange={(e) => setField('method', e.target.value as ArPaymentMethod)}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {arPaymentMethodLabel(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('arPayment.lblReceivedOn')} required>
          <input
            type="date"
            className={inputCls}
            value={form.receivedOn}
            onChange={(e) => setField('receivedOn', e.target.value)}
            required
          />
        </Field>
        <Field label={t('arPayment.lblAmount')} required>
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
        <Field label={t('arPayment.lblRefNum')}>
          <input
            className={inputCls}
            value={form.referenceNumber}
            onChange={(e) => setField('referenceNumber', e.target.value)}
            placeholder={t('arPayment.phRefNum')}
          />
        </Field>
        <Field label={t('arPayment.lblPayer')}>
          <input
            className={inputCls}
            value={form.payerName}
            onChange={(e) => setField('payerName', e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t('arPayment.secDeposit')}>
        <Field label={t('arPayment.lblDepositAcct')}>
          <input
            className={inputCls}
            value={form.depositAccount}
            onChange={(e) => setField('depositAccount', e.target.value)}
            placeholder={t('arPayment.phDepositAcct')}
          />
        </Field>
        <Field label={t('arPayment.lblDepositedOn')}>
          <input
            type="date"
            className={inputCls}
            value={form.depositedOn}
            onChange={(e) => setField('depositedOn', e.target.value)}
          />
        </Field>
      </Section>

      {form.kind === 'RETENTION_RELEASE' && (
        <Section title={t('arPayment.secRetention')}>
          <Field label={t('arPayment.lblRetCompleted')}>
            <input
              type="date"
              className={inputCls}
              value={form.retentionCompletedOn}
              onChange={(e) => setField('retentionCompletedOn', e.target.value)}
            />
          </Field>
          <Field label={t('arPayment.lblRetHeld')}>
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputCls}
              value={form.retentionHeldDollars}
              onChange={(e) => setField('retentionHeldDollars', e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            {interestPreview ? (
              <div
                className={`rounded border p-3 text-sm ${
                  interestPreview.daysLate > 0
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : 'border-green-200 bg-green-50 text-green-800'
                }`}
              >
                <div>
                  {t('arPayment.dueOn')} <strong>{interestPreview.dueOn}</strong>
                </div>
                <div className="mt-1">
                  {t('arPayment.daysLate')} <strong>{interestPreview.daysLate}</strong>
                </div>
                <div className="mt-1">
                  {t('arPayment.statInterest')}{' '}
                  <strong>{formatUSD(interestPreview.interestCents)}</strong>
                </div>
                <div className="mt-2 text-xs opacity-80">
                  {t('arPayment.note7107')}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                {t('arPayment.previewHint')}
              </p>
            )}
          </div>
        </Section>
      )}

      <Section title={t('arPayment.secNotes')}>
        <Field label={t('arPayment.lblNotes')} full>
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
          {saving ? t('arPayment.busy') : mode === 'create' ? t('arPayment.create') : t('arPayment.save')}
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
