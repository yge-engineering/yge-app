// DataTable — reusable table for list pages.
//
// Plain English: every list page in the app renders a <table> with a
// gray header row, divide-y body, hover-on-row. Centralize the markup
// so styling stays consistent (and we can theme it once later).

import type React from 'react';

interface Column<T> {
  key: string;
  header: string;
  /** Render the cell. Defaults to (row[key]) if not supplied. */
  cell?: (row: T) => React.ReactNode;
  /** Right-align the cell (numbers / money). */
  numeric?: boolean;
  /** Tailwind width / display classes. */
  className?: string;
}

interface Props<T extends { id?: string }> {
  rows: T[];
  columns: Column<T>[];
  /** Stable React key — defaults to row.id. */
  keyFn?: (row: T) => string;
  /** Click row → href. Pass a function to derive the URL per row. */
  rowHref?: (row: T) => string | null;
}

export function DataTable<T extends { id?: string }>({ rows, columns, keyFn, rowHref }: Props<T>) {
  const getKey = keyFn ?? ((r: T) => r.id ?? Math.random().toString(36));
  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-4 py-2 font-semibold ${c.numeric ? 'text-right' : ''} ${c.className ?? ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => {
            const href = rowHref?.(r);
            return (
              <tr
                key={getKey(r)}
                className={href ? 'cursor-pointer hover:bg-gray-50' : 'hover:bg-gray-50'}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-2 text-gray-700 ${c.numeric ? 'text-right' : ''} ${c.className ?? ''}`}
                  >
                    {c.cell ? c.cell(r) : ((r as unknown as Record<string, React.ReactNode>)[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
