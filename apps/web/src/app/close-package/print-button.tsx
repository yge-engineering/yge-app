'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 print:hidden"
    >
      🖨 Print to PDF
    </button>
  );
}
