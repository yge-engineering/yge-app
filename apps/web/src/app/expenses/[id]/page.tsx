// /expenses/[id] — expense detail / edit.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Expense } from '@yge/shared';
import { ExpenseEditor } from '../../../components/expense-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchExpense(id: string): Promise<Expense | null> {
  const res = await fetch(`${apiBaseUrl()}/api/expenses/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { expense: Expense }).expense;
}

export default async function ExpenseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const expense = await fetchExpense(params.id);
  if (!expense) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/expenses" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Expenses
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{expense.vendor}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {expense.employeeName} · {expense.receiptDate}
      </p>
      <p className="mt-1 text-xs text-gray-500">ID: {expense.id}</p>
      <div className="mt-6">
        <ExpenseEditor mode="edit" expense={expense} />
      </div>
    </main>
  );
}
