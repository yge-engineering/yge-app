import { PrintGradePanel } from './print-grade-panel';

export const dynamic = 'force-dynamic';

export default function AtAGlanceGradePrintPage() {
  return (
    <main className="mx-auto max-w-2xl bg-white p-8 print:p-0">
      <header className="mb-4 border-b border-gray-300 pb-3">
        <h1 className="text-2xl font-bold text-gray-900">Master-data grade</h1>
        <p className="text-xs text-gray-600">Young General Engineering, Inc. · printed from YGE app.</p>
      </header>
      <PrintGradePanel />
      <footer className="mt-6 text-[10px] text-gray-500">
        A = 95%+ · B = 85-94% · C = 70-84% · D = 50-69% · F = below 50%.
      </footer>
    </main>
  );
}
