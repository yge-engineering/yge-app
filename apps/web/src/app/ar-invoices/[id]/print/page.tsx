// /ar-invoices/[id]/print — print-ready customer invoice.
//
// Layout matches Cal Fire's Budget Detail and Payment Provisions
// requirements (per agreement 1CA07840 Sulphur Springs Road):
//   - Agreement number printed at the top
//   - Date range / time-period when costs were incurred
//   - Description of service + quantity + rate + total per line
//   - Submitted in arrears, monthly to quarterly
//   - Cal Fire submit-to address block
//
// The same layout works for Caltrans + counties + private clients;
// the customerName + customerProjectNumber + customerAddress fields
// drive the per-customer text. When per-agency overrides become a
// thing, this page reads them off the Job's billingProfile (TODO).

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  arInvoiceLineKindLabel,
  formatUSD,
  type ArInvoice,
  type Job,
} from '@yge/shared';
import { PrintButton } from '@/components/print-button';
import { Letterhead } from '@/components/letterhead';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchInvoice(id: string): Promise<ArInvoice | null> {
  const res = await fetch(
    `${apiBaseUrl()}/api/ar-invoices/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return ((await res.json()) as { invoice: ArInvoice }).invoice;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}

function formatPeriod(invoice: ArInvoice): string {
  if (invoice.billingPeriodStart && invoice.billingPeriodEnd) {
    return `${invoice.billingPeriodStart} through ${invoice.billingPeriodEnd}`;
  }
  return invoice.invoiceDate;
}

export default async function ArInvoicePrintPage({
  params,
}: {
  params: { id: string };
}) {
  const [invoice, jobs] = await Promise.all([fetchInvoice(params.id), fetchJobs()]);
  if (!invoice) notFound();
  const job = jobs.find((j) => j.id === invoice.jobId);

  return (
    <>
      <style>{`
        @page { margin: 0.75in 0.75in; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        .invoice-table { break-inside: auto; }
        .invoice-totals { break-inside: avoid; page-break-inside: avoid; }
      `}</style>

      <div className="no-print bg-gray-100 px-8 py-3 text-sm text-gray-700">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href={`/ar-invoices/${invoice.id}`}
            className="text-yge-blue-500 hover:underline"
          >
            &larr; Back to editor
          </Link>
          <PrintButton />
        </div>
      </div>

      <main className="mx-auto max-w-4xl bg-white px-12 py-10 text-gray-900">
        {/* Letterhead */}
        <Letterhead />

        {/* Invoice title + meta */}
        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold uppercase tracking-wide text-yge-blue-700">
              Invoice
            </h2>
            <p className="mt-1 text-sm text-gray-700">
              Number: <span className="font-mono font-semibold">{invoice.invoiceNumber}</span>
            </p>
            <p className="text-sm text-gray-700">Date: {invoice.invoiceDate}</p>
            {invoice.dueDate && (
              <p className="text-sm text-gray-700">Due: {invoice.dueDate}</p>
            )}
          </div>
          <div className="rounded border border-yge-blue-200 bg-yge-blue-50 p-3 text-sm">
            {invoice.customerProjectNumber && (
              <div>
                <span className="text-xs uppercase tracking-wide text-gray-500">
                  Agreement #
                </span>
                <div className="font-mono font-semibold text-yge-blue-700">
                  {invoice.customerProjectNumber}
                </div>
              </div>
            )}
            <div className="mt-2">
              <span className="text-xs uppercase tracking-wide text-gray-500">
                Period
              </span>
              <div className="text-gray-800">{formatPeriod(invoice)}</div>
            </div>
            {job && (
              <div className="mt-2">
                <span className="text-xs uppercase tracking-wide text-gray-500">
                  Project
                </span>
                <div className="text-gray-800">{job.projectName}</div>
              </div>
            )}
          </div>
        </div>

        {/* Bill-to */}
        <section className="mt-8">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            Bill to
          </div>
          <div className="mt-1 font-semibold text-gray-900">
            {invoice.customerName}
          </div>
          {invoice.customerAddress && (
            <div className="whitespace-pre-line text-sm text-gray-700">
              {invoice.customerAddress}
            </div>
          )}
        </section>

        {/* Description block */}
        {invoice.description && (
          <section className="mt-6 rounded border border-gray-200 bg-gray-50 p-4 text-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              Description of services
            </div>
            <p className="mt-1 whitespace-pre-line text-gray-800 leading-relaxed">
              {invoice.description}
            </p>
          </section>
        )}

        {/* Line items table */}
        <section className="mt-6">
          <table className="invoice-table w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-yge-blue-500">
                <th className="py-2 pr-3 text-xs uppercase tracking-wide text-gray-700">
                  Description
                </th>
                <th className="py-2 pr-3 text-xs uppercase tracking-wide text-gray-700">
                  Kind
                </th>
                <th className="py-2 pr-3 text-right text-xs uppercase tracking-wide text-gray-700">
                  Quantity
                </th>
                <th className="py-2 pr-3 text-right text-xs uppercase tracking-wide text-gray-700">
                  Rate
                </th>
                <th className="py-2 text-right text-xs uppercase tracking-wide text-gray-700">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.lineItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-500">
                    No line items.
                  </td>
                </tr>
              ) : (
                invoice.lineItems.map((li, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 align-top">
                      <div className="font-medium text-gray-900">
                        {li.description}
                      </div>
                      {li.note && (
                        <div className="mt-0.5 text-xs text-gray-500">
                          {li.note}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3 align-top text-xs text-gray-600">
                      {arInvoiceLineKindLabel(li.kind)}
                    </td>
                    <td className="py-2 pr-3 text-right align-top tabular-nums">
                      {li.quantity}
                      {li.unit && <span className="text-gray-500"> {li.unit}</span>}
                    </td>
                    <td className="py-2 pr-3 text-right align-top tabular-nums">
                      {formatUSD(li.unitPriceCents)}
                    </td>
                    <td className="py-2 text-right align-top font-medium tabular-nums">
                      {formatUSD(li.lineTotalCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* Totals */}
        <section className="invoice-totals mt-6 ml-auto sm:max-w-sm">
          <div className="space-y-1 rounded border border-gray-200 bg-gray-50 p-4 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono">{formatUSD(invoice.subtotalCents)}</span>
            </div>
            {invoice.taxCents !== undefined && invoice.taxCents > 0 && (
              <div className="flex justify-between">
                <span>Tax</span>
                <span className="font-mono">{formatUSD(invoice.taxCents)}</span>
              </div>
            )}
            {invoice.retentionCents !== undefined && invoice.retentionCents > 0 && (
              <div className="flex justify-between text-orange-700">
                <span>Less retention</span>
                <span className="font-mono">-{formatUSD(invoice.retentionCents)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-yge-blue-500 pt-2 text-lg font-bold">
              <span>Total due</span>
              <span className="font-mono">{formatUSD(invoice.totalCents)}</span>
            </div>
            {invoice.paidCents > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span>Paid</span>
                  <span className="font-mono">{formatUSD(invoice.paidCents)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-300 pt-1 text-base font-semibold">
                  <span>Balance</span>
                  <span className="font-mono">
                    {formatUSD(Math.max(0, invoice.totalCents - invoice.paidCents))}
                  </span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Footer / certifications */}
        <footer className="mt-12 border-t border-gray-200 pt-4 text-xs text-gray-600">
          <p>
            Submitted in arrears for services satisfactorily completed in
            accordance with the agreement.
          </p>
          <p className="mt-2">
            Young General Engineering, Inc. &middot; CSLB #1145219 &middot; DIR
            #2000018967 &middot; DOT #4528204
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <div className="border-b border-gray-400 pb-1"></div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                Authorized signature
              </div>
            </div>
            <div>
              <div className="border-b border-gray-400 pb-1"></div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                Date
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
