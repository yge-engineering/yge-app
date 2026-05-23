'use client';

// /purchase-orders — draft a PO body for email or printable.
//
// Wires bundle 2534. Office fills in vendor + ship-to + cost code +
// lines + terms; renders the plain-text PO body next to the form.
// No DB yet — caller copies the body into Outlook or saves as a PDF.

import { useMemo, useState } from 'react';

import {
  PurchaseOrderSchema,
  PurchaseOrderTermsSchema,
  computeTotals,
  renderPurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type PurchaseOrderTerms,
} from '@yge/shared';

import { AppShell, PageHeader, Tile } from '../../components';

const INPUT = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';
const TERMS_OPTS: PurchaseOrderTerms[] = PurchaseOrderTermsSchema.options;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface LineDraft {
  description: string;
  quantityStr: string;
  unit: string;
  unitDollarsStr: string;
}

function emptyLine(): LineDraft {
  return { description: '', quantityStr: '1', unit: 'EA', unitDollarsStr: '0' };
}

export default function PurchaseOrderPage() {
  const [poNumber, setPoNumber] = useState('YGE-SS2026-014');
  const [vendorName, setVendorName] = useState('Hat Creek Construction Materials');
  const [vendorAddress, setVendorAddress] = useState('12345 Hat Creek Rd, Hat Creek CA 96040');
  const [vendorContact, setVendorContact] = useState('');
  const [shipTo, setShipTo] = useState('Sulphur Springs Job Site, Soquol Rd');
  const [jobName, setJobName] = useState('Sulphur Springs Soquol Rd');
  const [jobId, setJobId] = useState('');
  const [costCode, setCostCode] = useState('02-AGG');
  const [orderDate, setOrderDate] = useState(todayIso());
  const [requiredBy, setRequiredBy] = useState('');
  const [terms, setTerms] = useState<PurchaseOrderTerms>('NET_30');
  const [notes, setNotes] = useState('');
  const [signerName, setSignerName] = useState('Ryan Young');
  const [signerTitle, setSignerTitle] = useState('VP');
  const [taxDollars, setTaxDollars] = useState('0');
  const [lines, setLines] = useState<LineDraft[]>([
    { description: '3/4" drain rock', quantityStr: '100', unit: 'TON', unitDollarsStr: '25.00' },
    { description: 'Sand fill', quantityStr: '50', unit: 'TON', unitDollarsStr: '18.00' },
  ]);
  const [copied, setCopied] = useState(false);

  function setLineField<K extends keyof LineDraft>(idx: number, key: K, value: LineDraft[K]) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const po = useMemo<PurchaseOrder | null>(() => {
    const parsedLines: PurchaseOrderLine[] = lines.flatMap((l) => {
      if (!l.description.trim()) return [];
      const qty = Number(l.quantityStr);
      const dollars = Number(l.unitDollarsStr);
      if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(dollars) || dollars < 0) return [];
      return [
        {
          description: l.description.trim(),
          quantity: qty,
          unit: l.unit.trim() || undefined,
          unitPriceCents: Math.round(dollars * 100),
        },
      ];
    });
    if (parsedLines.length === 0) return null;
    const raw: Record<string, unknown> = {
      id: poNumber,
      poNumber,
      vendorName: vendorName.trim(),
      vendorAddress: vendorAddress.trim(),
      vendorContactName: vendorContact.trim() || undefined,
      shipTo: shipTo.trim(),
      jobId: jobId.trim() || undefined,
      jobName: jobName.trim() || undefined,
      costCode: costCode.trim() || undefined,
      orderDate,
      requiredByDate: requiredBy || undefined,
      lines: parsedLines,
      terms,
      notes: notes.trim() || undefined,
      signedByName: signerName.trim() || 'Ryan Young',
      signedByTitle: signerTitle.trim() || 'VP',
    };
    const parsed = PurchaseOrderSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }, [
    poNumber,
    vendorName,
    vendorAddress,
    vendorContact,
    shipTo,
    jobId,
    jobName,
    costCode,
    orderDate,
    requiredBy,
    lines,
    terms,
    notes,
    signerName,
    signerTitle,
  ]);

  const taxCents = Math.round((Number(taxDollars) || 0) * 100);
  const totals = po ? computeTotals(po, taxCents) : null;
  const body = po ? renderPurchaseOrder(po, taxCents) : null;

  async function copyBody() {
    if (!body) return;
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore older browsers
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <PageHeader
          title="Purchase order builder"
          subtitle="Vendor + ship-to + cost code + line items. Renders the printable PO body next to the form. Subtotal/tax/total update live."
        />

        {totals && (
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Tile label="Lines" value={String(totals.lineCount)} />
            <Tile label="Subtotal" value={fmt$(totals.subtotalCents)} />
            <Tile label="Tax" value={fmt$(totals.taxCents)} />
            <Tile label="Total" value={fmt$(totals.totalCents)} />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">PO header</h2>
            <Field label="PO number">
              <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className={`${INPUT} font-mono`} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Order date">
                <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Required by (optional)">
                <input type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} className={INPUT} />
              </Field>
            </div>

            <h2 className="mt-6 text-lg font-semibold text-gray-900">Vendor</h2>
            <Field label="Vendor name">
              <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Vendor address">
              <input value={vendorAddress} onChange={(e) => setVendorAddress(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Contact name (optional)">
              <input value={vendorContact} onChange={(e) => setVendorContact(e.target.value)} className={INPUT} />
            </Field>

            <h2 className="mt-6 text-lg font-semibold text-gray-900">Ship-to + job</h2>
            <Field label="Ship-to">
              <input value={shipTo} onChange={(e) => setShipTo(e.target.value)} className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Job name (optional)">
                <input value={jobName} onChange={(e) => setJobName(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Job id (optional)">
                <input value={jobId} onChange={(e) => setJobId(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Cost code">
                <input value={costCode} onChange={(e) => setCostCode(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Terms">
                <select value={terms} onChange={(e) => setTerms(e.target.value as PurchaseOrderTerms)} className={INPUT}>
                  {TERMS_OPTS.map((t) => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
              </Field>
            </div>

            <h2 className="mt-6 text-lg font-semibold text-gray-900">Lines</h2>
            {lines.map((l, idx) => (
              <div key={idx} className="mt-2 grid grid-cols-12 gap-2">
                <input
                  className={`col-span-5 ${INPUT}`}
                  placeholder="Description"
                  value={l.description}
                  onChange={(e) => setLineField(idx, 'description', e.target.value)}
                />
                <input
                  className={`col-span-2 ${INPUT} font-mono`}
                  placeholder="Qty"
                  value={l.quantityStr}
                  onChange={(e) => setLineField(idx, 'quantityStr', e.target.value)}
                />
                <input
                  className={`col-span-1 ${INPUT} font-mono`}
                  placeholder="Unit"
                  value={l.unit}
                  onChange={(e) => setLineField(idx, 'unit', e.target.value)}
                />
                <input
                  className={`col-span-3 ${INPUT} font-mono`}
                  placeholder="Unit $"
                  value={l.unitDollarsStr}
                  onChange={(e) => setLineField(idx, 'unitDollarsStr', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="col-span-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-red-50 hover:text-red-700"
                  aria-label="Remove line"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLine}
              className="mt-3 rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
            >
              + Add line
            </button>

            <h2 className="mt-6 text-lg font-semibold text-gray-900">Tax + notes + signer</h2>
            <Field label="Tax ($)">
              <input value={taxDollars} onChange={(e) => setTaxDollars(e.target.value)} className={`${INPUT} font-mono`} />
            </Field>
            <Field label="Notes (printed on the PO)">
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Signer name">
                <input value={signerName} onChange={(e) => setSignerName(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Signer title">
                <input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} className={INPUT} />
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">PO body</h2>
              <button
                type="button"
                onClick={copyBody}
                disabled={!body}
                className="rounded bg-yge-blue-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
              >
                {copied ? 'Copied' : 'Copy PO body'}
              </button>
            </div>
            {body ? (
              <pre className="mt-3 whitespace-pre-wrap rounded border border-gray-200 bg-white p-4 font-mono text-xs leading-relaxed text-gray-900">
                {body}
              </pre>
            ) : (
              <p className="text-sm text-gray-500">
                Add at least one line with description + quantity + unit price to see the PO body.
              </p>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function fmt$(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
