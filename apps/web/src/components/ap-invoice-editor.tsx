'use client';

// AP invoice editor — line items + approval/payment/reject workflow.
//
// Approve / Pay / Reject are dedicated endpoints so the audit trail
// records the action separately from a generic PATCH.

import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  apStatusLabel,
  formatUSD,
  lineItemSumCents,
  paymentMethodLabel,
  unpaidBalanceCents,
  type ApInvoice,
  type ApInvoiceLineItem,
  type ApPaymentMethod,
  type Job,
} from '@yge/shared';

const PAYMENT_METHODS: ApPaymentMethod[] = [
  'CHECK',
  'ACH',
  'WIRE',
  'CREDIT_CARD',
  'CASH',
  'OTHER',
];

interface Props {
  initial: ApInvoice;
  jobs: Job[];
  apiBaseUrl: string;
}

export function ApInvoiceEditor({ initial, jobs, apiBaseUrl }: Props) {
  const t = useTranslator();
  const [inv, setInv] = useState<ApInvoice>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vendorName, setVendorName] = useState(inv.vendorName);
  const [invoiceNumber, setInvoiceNumber] = useState(inv.invoiceNumber ?? '');
  const [invoiceDate, setInvoiceDate] = useState(inv.invoiceDate);
  const [dueDate, setDueDate] = useState(inv.dueDate ?? '');
  const [totalDollars, setTotalDollars] = useState((inv.totalCents / 100).toFixed(2));
  const [notes, setNotes] = useState(inv.notes ?? '');

  // Payment form mirrors.
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<ApPaymentMethod>('CHECK');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');

  const [rejectReason, setRejectReason] = useState('');

  // Line item form.
  const [newDesc, setNewDesc] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newUnitDollars, setNewUnitDollars] = useState('');
  const [newJobId, setNewJobId] = useState('');

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/ap-invoices/${inv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const json = (await res.json()) as { invoice: ApInvoice };
      setInv(json.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function action(endpoint: string, body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/ap-invoices/${inv.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${endpoint} failed: ${res.status} ${text}`);
      }
      const json = (await res.json()) as { invoice: ApInvoice };
      setInv(json.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  }

  function saveHeader() {
    void patch({
      vendorName: vendorName.trim() || inv.vendorName,
      invoiceNumber: invoiceNumber.trim() || undefined,
      invoiceDate,
      dueDate: dueDate.trim() || undefined,
      totalCents: totalDollars.trim() ? Math.round(Number(totalDollars) * 100) : 0,
      notes: notes.trim() || undefined,
    });
  }

  function addLine() {
    if (newDesc.trim().length === 0) {
      setError('Line description is required.');
      return;
    }
    const qty = Number(newQty || '1');
    const unitCents = Math.round(Number(newUnitDollars || '0') * 100);
    const lineTotalCents = Math.round(qty * unitCents);
    const next: ApInvoiceLineItem = {
      description: newDesc.trim(),
      quantity: qty,
      unitPriceCents: unitCents,
      lineTotalCents,
      ...(newJobId ? { jobId: newJobId } : {}),
    };
    void patch({ lineItems: [...inv.lineItems, next] });
    setNewDesc('');
    setNewQty('1');
    setNewUnitDollars('');
    setNewJobId('');
  }

  function removeLine(i: number) {
    void patch({ lineItems: inv.lineItems.filter((_, idx) => idx !== i) });
  }

  function approve() {
    void action('approve', {});
  }

  function pay() {
    const amount = Math.round(Number(paymentAmount) * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t('apInv.errPaymentAmount'));
      return;
    }
    void action('pay', {
      paidAt: paymentDate,
      paymentMethod,
      paymentReference: paymentRef.trim() || undefined,
      amountCents: amount,
    });
    setPaymentAmount('');
    setPaymentRef('');
  }

  function reject() {
    if (rejectReason.trim().length === 0) {
      setError(t('apInv.errReason'));
      return;
    }
    void action('reject', { reason: rejectReason.trim() });
  }

  const balance = unpaidBalanceCents(inv);
  const lineSum = lineItemSumCents(inv);
  const job = inv.jobId ? jobs.find((j) => j.id === inv.jobId) : undefined;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {apStatusLabel(inv.status)}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-yge-blue-500">{inv.vendorName}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {inv.invoiceNumber && t('apInv.headerInvNumPrefix', { number: inv.invoiceNumber })}
            {t('apInv.headerInvDate', { date: inv.invoiceDate })}
            {inv.dueDate && t('apInv.headerDueSep', { date: inv.dueDate })}
            {job && t('apInv.headerJobSep', { project: job.projectName })}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-yge-blue-500">
            {formatUSD(inv.totalCents)}
          </div>
          <div className="text-xs text-gray-500">
            {t('apInv.paidBalance', { paid: formatUSD(inv.paidCents), balance: formatUSD(balance) })}
          </div>
          {saving && <div className="text-xs text-gray-500">{t('apInv.saving')}</div>}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Workflow actions */}
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t('apInv.workflowHeader')}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {(inv.status === 'DRAFT' || inv.status === 'PENDING') && (
            <button
              type="button"
              onClick={approve}
              className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
            >
              {t('apInv.approve')}
            </button>
          )}
          {(inv.status === 'APPROVED' || inv.status === 'DRAFT' || inv.status === 'PENDING') && balance > 0 && (
            <details className="relative">
              <summary className="cursor-pointer rounded bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700">
                {t('apInv.recordPayment')}
              </summary>
              <div className="absolute z-10 mt-2 grid w-80 gap-2 rounded border border-gray-200 bg-white p-3 text-sm shadow-lg">
                <Field label={t('apInv.lblPaymentDate')}>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </Field>
                <Field label={t('apInv.lblPaymentMethod')}>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as ApPaymentMethod)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {paymentMethodLabel(m)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('apInv.lblPaymentRef')}>
                  <input
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder={t('apInv.phPaymentRef')}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
                  />
                </Field>
                <Field label={t('apInv.lblPaymentAmount')}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder={(balance / 100).toFixed(2)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </Field>
                <button
                  type="button"
                  onClick={pay}
                  className="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700"
                >
                  {t('apInv.applyPayment')}
                </button>
              </div>
            </details>
          )}
          {inv.status !== 'PAID' && inv.status !== 'REJECTED' && (
            <details className="relative">
              <summary className="cursor-pointer rounded border border-red-300 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50">
                {t('apInv.reject')}
              </summary>
              <div className="absolute z-10 mt-2 grid w-80 gap-2 rounded border border-gray-200 bg-white p-3 text-sm shadow-lg">
                <Field label={t('apInv.lblReason')}>
                  <textarea
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </Field>
                <button
                  type="button"
                  onClick={reject}
                  className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
                >
                  {t('apInv.reject')}
                </button>
              </div>
            </details>
          )}
        </div>
        {inv.approvedAt && (
          <p className="mt-2 text-xs text-gray-500">
            {t('apInv.approvedNote', { when: new Date(inv.approvedAt).toLocaleString() })}
            {inv.approvedByEmployeeId && t('apInv.approvedBy', { who: inv.approvedByEmployeeId })}
          </p>
        )}
        {inv.paidAt && (
          <p className="mt-1 text-xs text-gray-500">
            {t('apInv.lastPayment', { date: inv.paidAt })}
            {inv.paymentMethod && t('apInv.viaMethod', { method: paymentMethodLabel(inv.paymentMethod) })}
            {inv.paymentReference && t('apInv.refSep', { ref: inv.paymentReference })}
          </p>
        )}
        {inv.rejectedReason && (
          <p className="mt-1 text-xs text-red-700">{t('apInv.rejectedNote', { reason: inv.rejectedReason })}</p>
        )}
      </section>

      {/* Header fields */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('apInv.lblVendor')}>
          <input
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            onBlur={saveHeader}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('apInv.lblInvoiceNum')}>
          <input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            onBlur={saveHeader}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label={t('apInv.lblJob')}>
          <select
            value={inv.jobId ?? ''}
            onChange={(e) => void patch({ jobId: e.target.value || undefined })}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('apInv.notJobSpecific')}</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.projectName}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('apInv.lblInvoiceDate')}>
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            onBlur={saveHeader}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('apInv.lblDueDate')}>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            onBlur={saveHeader}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('apInv.lblTotal')}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={totalDollars}
            onChange={(e) => setTotalDollars(e.target.value)}
            onBlur={saveHeader}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      {/* Line items */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{t('apInv.lineItemsHeader')}</h2>
        {inv.lineItems.length > 0 && Math.abs(lineSum - inv.totalCents) > 0 && (
          <div className="mb-3 rounded border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-800">
            {t('apInv.lineSumWarn', { sum: formatUSD(lineSum), total: formatUSD(inv.totalCents) })}
          </div>
        )}

        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <div className="grid gap-2 sm:grid-cols-5">
            <Field label={t('apInv.lblDescription')}>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label={t('apInv.lblQty')}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label={t('apInv.lblUnitDollar')}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newUnitDollars}
                onChange={(e) => setNewUnitDollars(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label={t('apInv.lblJob')}>
              <select
                value={newJobId}
                onChange={(e) => setNewJobId(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">{t('apInv.inheritJob')}</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.projectName}
                  </option>
                ))}
              </select>
            </Field>
            <div className="self-end">
              <button
                type="button"
                onClick={addLine}
                className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
              >
                {t('apInv.addLine')}
              </button>
            </div>
          </div>
        </div>

        {inv.lineItems.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t('apInv.lineItemsEmpty')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 rounded border border-gray-200 bg-white text-sm">
            {inv.lineItems.map((li, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 px-4 py-2"
              >
                <div>
                  <div className="font-medium text-gray-900">{li.description}</div>
                  <div className="text-xs text-gray-500">
                    {li.quantity} {li.unit ?? 'ea'} &middot;{' '}
                    {formatUSD(li.unitPriceCents)}
                    {li.jobId && t('apInv.lineJobSep', { project: jobs.find((j) => j.id === li.jobId)?.projectName ?? li.jobId })}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium text-gray-900">
                    {formatUSD(li.lineTotalCents)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    {t('apInv.removeLine')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Field label={t('apInv.lblNotes')}>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveHeader}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
