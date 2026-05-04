// /ap-payments/[id] — payment detail / edit.

import Link from 'next/link';
import { AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import type { ApPayment } from '@yge/shared';
import { ApPaymentEditor } from '../../../components/ap-payment-editor';
import { getTranslator } from '../../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchPayment(id: string): Promise<ApPayment | null> {
  const res = await fetch(`${apiBaseUrl()}/api/ap-payments/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { payment: ApPayment }).payment;
}

export default async function ApPaymentDetailPage({
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
        <Link href="/ap-payments" className="text-sm text-yge-blue-500 hover:underline">
          {t('paymentPg.checkRegister')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">
        {t('paymentPg.paymentTitle', { id: payment.id })}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {t('paymentPg.subtitleVendorDate', { vendor: payment.vendorName, date: payment.paidOn })}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {t('paymentPg.appliedToPrefix')}
        <Link
          href={`/ap-invoices/${payment.apInvoiceId}`}
          className="text-yge-blue-500 hover:underline"
        >
          {payment.apInvoiceId}
        </Link>
      </p>
      <div className="mt-6">
        <ApPaymentEditor mode="edit" payment={payment} />
      </div>

      <AuditBinderPanel entityType="ApPayment" entityId={payment.id} />
    </main>
  );
}
