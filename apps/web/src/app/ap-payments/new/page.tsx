// /ap-payments/new — record a new outgoing payment.

import Link from 'next/link';
import { ApPaymentEditor } from '../../../components/ap-payment-editor';

export default function NewApPaymentPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/ap-payments" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Check Register
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">Record payment</h1>
      <p className="mt-2 text-gray-700">
        Apply a check, ACH, wire, or other outgoing payment to an AP invoice.
      </p>
      <div className="mt-6">
        <ApPaymentEditor mode="create" />
      </div>
    </main>
  );
}
