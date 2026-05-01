// DescriptionList — label / value pair display for detail pages.
//
// Plain English: the "Customer: Caltrans / Status: Active / Address:
// 1727 30th St" pattern that every detail page rolls. Centralize the
// styling so spacing, font sizes, and the divider treatment are
// consistent.

import type React from 'react';

interface Item {
  label: string;
  value: React.ReactNode;
  /** Make this row span both columns. */
  full?: boolean;
}

interface Props {
  items: Item[];
  /** Two-column layout on desktop (default), or always one column. */
  columns?: 1 | 2;
}

export function DescriptionList({ items, columns = 2 }: Props) {
  const colsClass = columns === 1 ? '' : 'sm:grid-cols-2';
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-3 ${colsClass}`}>
      {items.map((it, i) => (
        <div key={i} className={it.full ? 'sm:col-span-2' : undefined}>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{it.label}</dt>
          <dd className="mt-0.5 text-sm text-gray-900">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
