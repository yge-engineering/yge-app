'use client';

// Client island that turns specific <th> cells into clickable sort
// triggers. The parent server component renders the table; we wire
// click + sort behavior on top of the existing DOM. No state held
// in React for the row data — we just re-order the existing rows
// and toggle aria-sort + arrow glyphs.

import { useEffect, useState } from 'react';

type SortDir = 'asc' | 'desc';

interface Props {
  /** ID of the target <table>. Headers must carry `data-sort-key`
   *  attributes matching one of the SORT_TYPES keys; rows must
   *  have matching `data-sort-{key}` attributes for the value. */
  targetId: string;
}

const SORT_TYPES: Record<string, 'number' | 'string'> = {
  cents: 'number',
  updated: 'string',
  due: 'string',
  name: 'string',
};

export function EstimatesSortHeaders({ targetId }: Props) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Wire click listeners on header cells.
  useEffect(() => {
    const table = document.getElementById(targetId);
    if (!table) return;
    const ths = table.querySelectorAll<HTMLElement>('thead th[data-sort-key]');
    const cleanups: Array<() => void> = [];
    ths.forEach((th) => {
      th.style.cursor = 'pointer';
      th.title = 'Click to sort';
      const handler = () => {
        const key = th.dataset['sortKey'];
        if (!key) return;
        setSortKey((prev) => {
          if (prev === key) {
            // toggle dir
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
            return key;
          }
          // new column: default desc for numeric, asc for string
          setSortDir(SORT_TYPES[key] === 'number' ? 'desc' : 'asc');
          return key;
        });
      };
      th.addEventListener('click', handler);
      cleanups.push(() => th.removeEventListener('click', handler));
    });
    return () => cleanups.forEach((c) => c());
  }, [targetId]);

  // Apply the active sort by re-ordering tbody rows.
  useEffect(() => {
    if (!sortKey) return;
    const table = document.getElementById(targetId);
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(
      tbody.querySelectorAll<HTMLTableRowElement>('tr[data-search]'),
    );
    const type = SORT_TYPES[sortKey] ?? 'string';
    const datasetKey = `sort${sortKey.charAt(0).toUpperCase()}${sortKey.slice(1)}`;
    rows.sort((a, b) => {
      const av = a.dataset[datasetKey] ?? '';
      const bv = b.dataset[datasetKey] ?? '';
      let cmp = 0;
      if (type === 'number') {
        const na = Number(av);
        const nb = Number(bv);
        cmp = (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
      } else {
        cmp = av.localeCompare(bv);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    rows.forEach((r) => tbody.appendChild(r));

    // Reset arrows on every header, then mark active one.
    const ths = table.querySelectorAll<HTMLElement>('thead th[data-sort-key]');
    ths.forEach((th) => {
      const key = th.dataset['sortKey'];
      const arrowEl = th.querySelector<HTMLElement>('.sort-arrow');
      if (arrowEl) {
        arrowEl.textContent =
          key === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      }
      th.setAttribute(
        'aria-sort',
        key === sortKey
          ? sortDir === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none',
      );
    });
  }, [sortKey, sortDir, targetId]);

  return null;
}
