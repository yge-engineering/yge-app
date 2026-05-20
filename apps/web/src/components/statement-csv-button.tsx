'use client';

// Generic "Download CSV" button for financial statements. The page builds
// the rows server-side (it already has the computed statement); this just
// serializes them (RFC-4180) and triggers a client-side download. Kept
// dependency-free so it bundles tiny.

function esc(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function StatementCsvButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  function download() {
    const body = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
    const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  return (
    <button
      type="button"
      onClick={download}
      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
    >
      Download CSV
    </button>
  );
}
