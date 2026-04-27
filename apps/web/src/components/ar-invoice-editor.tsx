'use client';

// AR invoice editor — header + line items + the daily-report builder.
//
// The "Build from daily reports" panel lets the user pick a date range
// and a default labor rate, then the API aggregates submitted daily
// reports for that period into LABOR line items (one per
// classification, or consolidated, per the toggle). The result writes
// onto the invoice via PATCH so it's fully editable afterward.

import { useState } from 'react';
import {
  arInvoiceLineKindLabel,
  arInvoiceSourceLabel,
  arInvoiceStatusLabel,
  arUnpaidBalanceCents,
  formatUSD,
  type ArInvoice,
  type ArInvoiceLineItem,
  type ArInvoiceLineKind,
  type ArInvoiceSource,
  type ArInvoiceStatus,
  type Job,
} from '@yge/shared';

const STATUSES: ArInvoiceStatus[] = ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'DISPUTED', 'WRITTEN_OFF'];
const SOURCES: ArInvoiceSource[] = ['MANUAL', 'DAILY_REPORTS', 'PROGRESS', 'LUMP_SUM'];
const LINE_KINDS: ArInvoiceLineKind[] = ['LABOR', 'EQUIPMENT', 'MATERIAL', 'SUBCONTRACT', 'OTHER'];

interface Props {
  initial: ArInvoice;
  jobs: Job[];
  apiBaseUrl: string;
}

export function ArInvoiceEditor({ initial, jobs, apiBaseUrl }: Props) {
  const [inv, setInv] = useState<ArInvoice>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState(inv.customerName);
  const [customerAddress, setCustomerAddress] = useState(inv.customerAddress ?? '');
  const [customerProjectNumber, setCustomerProjectNumber] = useState(inv.customerProjectNumber ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState(inv.invoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(inv.invoiceDate);
  const [billingPeriodStart, setBillingPeriodStart] = useState(inv.billingPeriodStart ?? '');
  const [billingPeriodEnd, setBillingPeriodEnd] = useState(inv.billingPeriodEnd ?? '');
  const [dueDate, setDueDate] = useState(inv.dueDate ?? '');
  const [taxDollars, setTaxDollars] = useState(
    inv.taxCents !== undefined ? (inv.taxCents / 100).toFixed(2) : '',
  );
  const [retentionDollars, setRetentionDollars] = useState(
    inv.retentionCents !== undefined ? (inv.retentionCents / 100).toFixed(2) : '',
  );
  const [description, setDescription] = useState(inv.description ?? '');
  const [notes, setNotes] = useState(inv.notes ?? '');

  // Build-from-daily-reports form.
  const [buildStart, setBuildStart] = useState(inv.billingPeriodStart ?? '');
  const [buildEnd, setBuildEnd] = useState(inv.billingPeriodEnd ?? '');
  const [defaultRateDollars, setDefaultRateDollars] = useState('');
  const [consolidateLabor, setConsolidateLabor] = useState(false);
  const [buildSummary, setBuildSummary] = useState<string | null>(null);

  // Manual line item form.
  const [newKind, setNewKind] = useState<ArInvoiceLineKind>('LABOR');
  const [newDesc, setNewDesc] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newUnit, setNewUnit] = useState('HR');
  const [newUnitDollars, setNewUnitDollars] = useState('');

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/ar-invoices/${inv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const json = (await res.json()) as { invoice: ArInvoice };
      setInv(json.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function saveHeader() {
    void patch({
      customerName: customerName.trim() || inv.customerName,
      customerAddress: customerAddress.trim() || undefined,
      customerProjectNumber: customerProjectNumber.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || inv.invoiceNumber,
      invoiceDate,
      billingPeriodStart: billingPeriodStart.trim() || undefined,
      billingPeriodEnd: billingPeriodEnd.trim() || undefined,
      dueDate: dueDate.trim() || undefined,
      taxCents: taxDollars.trim() ? Math.round(Number(taxDollars) * 100) : undefined,
      retentionCents: retentionDollars.trim()
        ? Math.round(Number(retentionDollars) * 100)
        : undefined,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  async function buildFromReports() {
    if (!buildStart || !buildEnd) {
      setError('Set the billing period start + end first.');
      return;
    }
    const rate = Math.round(Number(defaultRateDollars || '0') * 100);
    setSaving(true);
    setError(null);
    setBuildSummary(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/ar-invoices/${inv.id}/build-from-daily-reports`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start: buildStart,
            end: buildEnd,
            defaultLaborRateCentsPerHour: rate,
            consolidateLabor,
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Build failed: ${res.status} ${text}`);
      }
      const json = (await res.json()) as {
        invoice: ArInvoice;
        built: {
          reportsConsulted: number;
          unsubmittedReportsSkipped: number;
        };
      };
      setInv(json.invoice);
      setBuildSummary(
        `Built ${json.invoice.lineItems.length} line item(s) from ` +
          `${json.built.reportsConsulted} daily report(s)` +
          (json.built.unsubmittedReportsSkipped > 0
            ? ` (${json.built.unsubmittedReportsSkipped} unsubmitted report(s) skipped)`
            : ''),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Build failed');
    } finally {
      setSaving(false);
    }
  }

  function addLine() {
    if (newDesc.trim().length === 0) {
      setError('Line description is required.');
      return;
    }
    const qty = Number(newQty || '1');
    const unitCents = Math.round(Number(newUnitDollars || '0') * 100);
    const line: ArInvoiceLineItem = {
      kind: newKind,
      description: newDesc.trim(),
      unit: newUnit.trim() || undefined,
      quantity: qty,
      unitPriceCents: unitCents,
      lineTotalCents: Math.round(qty * unitCents),
    };
    void patch({ lineItems: [...inv.lineItems, line] });
    setNewDesc('');
    setNewQty('1');
    setNewUnitDollars('');
  }

  function removeLine(i: number) {
    void patch({ lineItems: inv.lineItems.filter((_, idx) => idx !== i) });
  }

  const balance = arUnpaidBalanceCents(inv);
  const job = jobs.find((j) => j.id === inv.jobId);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {arInvoiceStatusLabel(inv.status)} &middot; {arInvoiceSourceLabel(inv.source)}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-yge-blue-500">
            #{inv.invoiceNumber} &mdash; {inv.customerName}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {job ? job.projectName : inv.jobId}
            {' '}\u00b7 invoice {inv.invoiceDate}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-yge-blue-500">
            {formatUSD(inv.totalCents)}
          </div>
          <div className="text-xs text-gray-500">
            {formatUSD(inv.paidCents)} paid &middot; {formatUSD(balance)} balance
          </div>
          <select
            value={inv.status}
            onChange={(e) => void patch({ status: e.target.value as ArInvoiceStatus })}
            className="mt-2 rounded border border-gray-300 px-2 py-1 text-xs"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {arInvoiceStatusLabel(s)}
              </option>
            ))}
          </select>
          <div className="mt-2">
            <a
              href={`/ar-invoices/${inv.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
            >
              Print &rarr;
            </a>
          </div>
          {saving && <div className="text-xs text-gray-500">Saving&hellip;</div>}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Build from daily reports */}
      <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-800">
          Build from daily reports
        </h2>
        <p className="mb-3 text-xs text-blue-900">
          Aggregates submitted daily reports for this job into one LABOR line
          per DIR classification, or one consolidated LABOR line. Pull-built
          line items are fully editable afterward.
        </p>
        <div className="grid gap-3 sm:grid-cols-5">
          <Field label="Period start">
            <input
              type="date"
              value={buildStart}
              onChange={(e) => setBuildStart(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Period end">
            <input
              type="date"
              value={buildEnd}
              onChange={(e) => setBuildEnd(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Default rate ($/hr)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={defaultRateDollars}
              onChange={(e) => setDefaultRateDollars(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Consolidate?">
            <div className="flex h-9 items-center">
              <input
                type="checkbox"
                checked={consolidateLabor}
                onChange={(e) => setConsolidateLabor(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="ml-2 text-xs">All as one LABOR line</span>
            </div>
          </Field>
          <div className="self-end">
            <button
              type="button"
              onClick={buildFromReports}
              className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
            >
              Build
            </button>
          </div>
        </div>
        {buildSummary && (
          <p className="mt-3 text-xs text-blue-900">{buildSummary}</p>
        )}
      </section>

      {/* Header fields */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer">
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            onBlur={saveHeader}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Customer project / PO">
          <input
            value={customerProjectNumber}
            onChange={(e) => setCustomerProjectNumber(e.target.value)}
            onBlur={saveHeader}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label="Customer address">
          <textarea
            rows={3}
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            onBlur={saveHeader}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Description (printed below header)">
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveHeader}
            placeholder="e.g. 'Vegetation management work performed for the period of...'"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Invoice #">
          <input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            onBlur={saveHeader}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label="Invoice date">
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            onBlur={saveHeader}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Billing period start">
          <input
            type="date"
            value={billingPeriodStart}
            onChange={(e) => setBillingPeriodStart(e.target.value)}
            onBlur={saveHeader}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Billing period end">
          <input
            type="date"
            value={billingPeriodEnd}
            onChange={(e) => setBillingPeriodEnd(e.target.value)}
            onBlur={saveHeader}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Due date">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            onBlur={saveHeader}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Tax ($)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={taxDollars}
            onChange={(e) => setTaxDollars(e.target.value)}
            onBlur={saveHeader}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Retention held ($)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={retentionDollars}
            onChange={(e) => setRetentionDollars(e.target.value)}
            onBlur={saveHeader}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      {/* Line items */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Line items</h2>

        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <div className="grid gap-2 sm:grid-cols-6">
            <Field label="Kind">
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as ArInvoiceLineKind)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {LINE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {arInvoiceLineKindLabel(k)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Qty">
              <input
                type="number"
                min="0"
                step="0.01"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Unit">
              <input
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Unit $">
              <input
                type="number"
                min="0"
                step="0.01"
                value={newUnitDollars}
                onChange={(e) => setNewUnitDollars(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <div className="self-end">
              <button
                type="button"
                onClick={addLine}
                className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
              >
                Add line
              </button>
            </div>
          </div>
        </div>

        {inv.lineItems.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No line items yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 rounded border border-gray-200 bg-white text-sm">
            {inv.lineItems.map((li, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 px-4 py-2"
              >
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {arInvoiceLineKindLabel(li.kind)}
                  </div>
                  <div className="font-medium text-gray-900">{li.description}</div>
                  <div className="text-xs text-gray-500">
                    {li.quantity} {li.unit ?? ''} &times;{' '}
                    {formatUSD(li.unitPriceCents)}
                    {li.note && (
                      <>
                        {' '}\u00b7 {li.note}
                      </>
                    )}
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
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Totals summary */}
        <div className="mt-4 grid gap-1 rounded border border-gray-200 bg-gray-50 p-3 text-sm sm:max-w-sm sm:ml-auto">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-mono">{formatUSD(inv.subtotalCents)}</span>
          </div>
          {inv.taxCents !== undefined && (
            <div className="flex justify-between">
              <span>Tax</span>
              <span className="font-mono">{formatUSD(inv.taxCents)}</span>
            </div>
          )}
          {inv.retentionCents !== undefined && inv.retentionCents > 0 && (
            <div className="flex justify-between text-orange-700">
              <span>Retention held</span>
              <span className="font-mono">-{formatUSD(inv.retentionCents)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-300 pt-1 text-base font-bold">
            <span>Total</span>
            <span className="font-mono">{formatUSD(inv.totalCents)}</span>
          </div>
        </div>
      </section>

      <Field label="Internal notes (not printed)">
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
