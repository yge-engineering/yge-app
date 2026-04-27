// /customers/[id] — customer detail / edit.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { customerDisplayName, type Customer } from '@yge/shared';
import { CustomerEditor } from '../../../components/customer-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchCustomer(id: string): Promise<Customer | null> {
  const res = await fetch(`${apiBaseUrl()}/api/customers/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { customer: Customer }).customer;
}

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const customer = await fetchCustomer(params.id);
  if (!customer) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/customers" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Customers
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">
        {customerDisplayName(customer)}
      </h1>
      {customer.dbaName && (
        <p className="mt-1 text-sm text-gray-600">Legal: {customer.legalName}</p>
      )}
      <p className="mt-1 text-xs text-gray-500">ID: {customer.id}</p>
      <div className="mt-6">
        <CustomerEditor mode="edit" customer={customer} />
      </div>
    </main>
  );
}
