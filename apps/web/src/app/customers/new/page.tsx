// /customers/new — create a new customer.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { CustomerEditor } from '../../../components/customer-editor';

export default function NewCustomerPage() {
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/customers" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Customers
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">New customer</h1>
      <p className="mt-2 text-gray-700">
        Add an agency, owner, or prime that YGE bills.
      </p>
      <div className="mt-6">
        <CustomerEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
