// /expenses/new — log a new expense receipt.

import Link from 'next/link';
import { ExpenseEditor } from '../../../components/expense-editor';

export default function NewExpensePage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/expenses" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Expenses
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">Log expense</h1>
      <p className="mt-2 text-gray-700">
        Record a single receipt. Pick the right category and the GL account
        prefills; override on the form if needed.
      </p>
      <div className="mt-6">
        <ExpenseEditor mode="create" />
      </div>
    </main>
  );
}
