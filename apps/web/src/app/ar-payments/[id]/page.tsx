// /ar-payments/[id] — payment detail / edit page.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ArPayment } from '@yge/shared';
import { ArPaymentEditor } from '../../../components/ar-payment-editor';
import { getTranslator } from '../../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchPayment(id: string): Promise<ArPayment | null> {
  const res = await fetch(`${apiBaseUrl()}/api/ar-payments/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { payment: ArPayment }).payment;
}

export default async function ArPaymentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const payment = await fetchPayment(params.id);
  if (!payment) notFound();
  const t = getTranslator();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/ar-payments" className="text-sm text-yge-blue-500 hover:underline">
          {t('paymentPg.customerPayments')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('paymentPg.paymentTitle', { id: payment.id })}</h1>
      <p className="mt-2 text-xs text-gray-500">
        {t('paymentPg.appliedToInvoicePrefix')}
        <Link
          href={`/ar-invoices/${payment.arInvoiceId}`}
          className="text-yge-blue-500 hover:underline"
        >
          {payment.arInvoiceId}
        </Link>
      </p>
      <div className="mt-6">
        <ArPaymentEditor mode="edit" payment={payment} />
      </div>
    </main>
  );
}
