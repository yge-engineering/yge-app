// /ap-payments/new — record a new outgoing payment.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { ApPaymentEditor } from '../../../components/ap-payment-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewApPaymentPage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/ap-payments" className="text-sm text-yge-blue-500 hover:underline">
          {t('paymentPg.checkRegister')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('paymentPg.recordApTitle')}</h1>
      <p className="mt-2 text-gray-700">
        {t('paymentPg.recordApSubtitle')}
      </p>
      <div className="mt-6">
        <ApPaymentEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
