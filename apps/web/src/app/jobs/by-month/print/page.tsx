import { PrintMonthPanel } from './print-month-panel';

export const dynamic = 'force-dynamic';

export default function JobsByMonthPrintPage() {
  return (
    <main className="mx-auto max-w-3xl bg-white p-8 print:p-0">
      <header className="mb-4 border-b border-gray-300 pb-3">
        <h1 className="text-2xl font-bold text-gray-900">Jobs by month</h1>
        <p className="text-xs text-gray-600">Young General Engineering, Inc. · printed from YGE app.</p>
      </header>
      <PrintMonthPanel />
      <footer className="mt-6 text-[10px] text-gray-500">
        Month derived from startDate (falling back to contractAwardDate when missing).
      </footer>
    </main>
  );
}
