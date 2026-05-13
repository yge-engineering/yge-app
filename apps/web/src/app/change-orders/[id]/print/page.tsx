// /change-orders/[id]/print — Letter-size print version.

import { notFound } from 'next/navigation';

import { Money } from '../../../../components';
import type { ChangeOrder } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchChangeOrder(id: string): Promise<ChangeOrder | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/change-orders/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { changeOrder: ChangeOrder };
    return body.changeOrder;
  } catch {
    return null;
  }
}

export default async function ChangeOrderPrintPage({
  params,
}: {
  params: { id: string };
}) {
  const co = await fetchChangeOrder(params.id);
  if (!co) notFound();

  return (
    <main className="mx-auto max-w-3xl bg-white px-8 py-6 text-black print:max-w-none print:px-4 print:py-0">
      <header className="mb-4 border-b-2 border-gray-800 pb-2">
        <h1 className="text-xl font-bold">CHANGE ORDER {co.changeOrderNumber}</h1>
        <p className="text-sm">{co.subject}</p>
      </header>

      <section className="mb-4 text-sm">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="border border-gray-300 p-1 font-semibold">Job ID</td>
              <td className="border border-gray-300 p-1">{co.jobId}</td>
              <td className="border border-gray-300 p-1 font-semibold">Status</td>
              <td className="border border-gray-300 p-1">{co.status}</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1 font-semibold">Reason</td>
              <td className="border border-gray-300 p-1">{co.reason}</td>
              <td className="border border-gray-300 p-1 font-semibold">Proposed</td>
              <td className="border border-gray-300 p-1">{co.proposedAt ?? '—'}</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1 font-semibold">Approved</td>
              <td className="border border-gray-300 p-1">{co.approvedAt ?? '—'}</td>
              <td className="border border-gray-300 p-1 font-semibold">Executed</td>
              <td className="border border-gray-300 p-1">{co.executedAt ?? '—'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-4">
        <h2 className="mb-1 border-b border-gray-300 text-sm font-bold uppercase">
          Description of change
        </h2>
        <p className="whitespace-pre-wrap text-sm">{co.description || '(no description)'}</p>
      </section>

      {co.lineItems.length > 0 ? (
        <section className="mb-4">
          <h2 className="mb-1 border-b border-gray-300 text-sm font-bold uppercase">
            Cost breakdown
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-gray-300 p-1 text-left text-xs uppercase">Item</th>
                <th className="border border-gray-300 p-1 text-right text-xs uppercase">Quantity</th>
                <th className="border border-gray-300 p-1 text-left text-xs uppercase">Unit</th>
                <th className="border border-gray-300 p-1 text-right text-xs uppercase">Unit price</th>
                <th className="border border-gray-300 p-1 text-right text-xs uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {co.lineItems.map((li, i) => (
                <tr key={i}>
                  <td className="border border-gray-300 p-1">{li.description}</td>
                  <td className="border border-gray-300 p-1 text-right font-mono">
                    {(li.quantity ?? 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-1">{li.unit ?? '—'}</td>
                  <td className="border border-gray-300 p-1 text-right font-mono">
                    <Money cents={li.unitPriceCents ?? 0} />
                  </td>
                  <td className="border border-gray-300 p-1 text-right font-mono">
                    <Money cents={li.amountCents} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="border border-gray-300 p-1 font-semibold" colSpan={4}>
                  Total cost impact
                </td>
                <td className="border border-gray-300 p-1 text-right font-mono font-semibold">
                  <Money cents={co.totalCostImpactCents} />
                </td>
              </tr>
              {co.totalScheduleImpactDays !== 0 ? (
                <tr>
                  <td className="border border-gray-300 p-1 font-semibold" colSpan={4}>
                    Schedule impact
                  </td>
                  <td className="border border-gray-300 p-1 text-right font-mono font-semibold">
                    {co.totalScheduleImpactDays} day{co.totalScheduleImpactDays === 1 ? '' : 's'}
                  </td>
                </tr>
              ) : null}
            </tfoot>
          </table>
        </section>
      ) : null}

      <section className="mb-4 grid grid-cols-2 gap-4">
        {typeof co.newContractAmountCents === 'number' ? (
          <div>
            <h2 className="text-xs font-bold uppercase text-gray-700">
              New contract amount
            </h2>
            <p className="font-mono text-base">
              <Money cents={co.newContractAmountCents} />
            </p>
          </div>
        ) : null}
        {co.newCompletionDate ? (
          <div>
            <h2 className="text-xs font-bold uppercase text-gray-700">
              New completion date
            </h2>
            <p className="text-base">{co.newCompletionDate}</p>
          </div>
        ) : null}
      </section>

      <section className="mt-8 grid grid-cols-2 gap-8 text-sm">
        <div>
          <div className="border-t border-gray-800 pt-1">
            Young General Engineering, Inc. — authorized signature
          </div>
          <p className="mt-1 text-xs">Date: ______________________</p>
        </div>
        <div>
          <div className="border-t border-gray-800 pt-1">
            Owner / Agency — authorized signature
          </div>
          <p className="mt-1 text-xs">Date: ______________________</p>
        </div>
      </section>

      {co.notes ? (
        <footer className="mt-4 border-t border-gray-300 pt-2 text-[10px] text-gray-600">
          <strong>Notes:</strong> {co.notes}
        </footer>
      ) : null}
    </main>
  );
}
