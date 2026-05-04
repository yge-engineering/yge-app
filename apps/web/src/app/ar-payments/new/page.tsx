// /ar-payments/new — record a new customer payment.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { ArPaymentEditor } from '../../../components/ar-payment-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewArPaymentPage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/ar-payments" className="text-sm text-yge-blue-500 hover:underline">
          {t('paymentPg.customerPayments')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('paymentPg.recordArTitle')}</h1>
      <p className="mt-2 text-gray-700">
        {t('paymentPg.recordArSubtitle')}
      </p>
      <div className="mt-6">
        <ArPaymentEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
