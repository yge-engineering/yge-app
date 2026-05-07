'use client';

// j / k to move focus down / up through /estimates rows.
// Enter on a focused row opens it.

import { useEffect } from 'react';

interface Props {
  targetId: string;
}

export function EstimatesKeyboardNav({ targetId }: Props) {
  useEffect(() => {
    function getVisibleRows(): HTMLTableRowElement[] {
      const table = document.getElementById(targetId);
      if (!table) return [];
      return Array.from(
        table.querySelectorAll<HTMLTableRowElement>('tbody > tr[data-search]'),
      ).filter((r) => r.style.display !== 'none');
    }

    function focusRow(idx: number) {
      const rows = getVisibleRows();
      if (rows.length === 0) return;
      const clamped = Math.max(0, Math.min(rows.length - 1, idx));
      const row = rows[clamped];
      if (!row) return;
      // Mark with data-row-focused for css highlight.
      rows.forEach((r) => delete r.dataset['rowFocused']);
      row.dataset['rowFocused'] = '1';
      row.classList.add('outline', 'outline-2', 'outline-yge-blue-500');
      rows.forEach((r) => {
        if (r !== row) r.classList.remove('outline', 'outline-2', 'outline-yge-blue-500');
      });
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function focusedIndex(): number {
      const rows = getVisibleRows();
      return rows.findIndex((r) => r.dataset['rowFocused'] === '1');
    }

    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          (t as HTMLElement).isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'j') {
        e.preventDefault();
        focusRow(focusedIndex() < 0 ? 0 : focusedIndex() + 1);
        return;
      }
      if (e.key === 'k') {
        e.preventDefault();
        focusRow(focusedIndex() < 0 ? 0 : focusedIndex() - 1);
        return;
      }
      if (e.key === 'Enter') {
        const rows = getVisibleRows();
        const i = focusedIndex();
        if (i >= 0) {
          const row = rows[i];
          if (!row) return;
          // Click the project-name link inside the row.
          const link = row.querySelector<HTMLAnchorElement>('a');
          if (link) {
            e.preventDefault();
            link.click();
          }
        }
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [targetId]);

  return null;
}
