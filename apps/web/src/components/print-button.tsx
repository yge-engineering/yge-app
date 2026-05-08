'use client';

// Reusable "Print to PDF" button for any printable page. Hides
// itself in @media print so it doesn't appear on the printout.

export function PrintButton({ label }: { label?: string } = {}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 print:hidden"
    >
      {label ?? '🖨 Print to PDF'}
    </button>
  );
}
