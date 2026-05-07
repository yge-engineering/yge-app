'use client';

// Reads pinned id count from localStorage; renders a small "📌 N"
// badge next to the page title when > 0.

import { useEffect, useState } from 'react';

interface Props {
  /** localStorage key holding a JSON array of pinned ids. */
  storageKey: string;
  /** Window event the parent fires when ids change. */
  eventName: string;
}

export function PinnedCountBadge({ storageKey, eventName }: Props) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    function refresh() {
      if (typeof window === 'undefined') return;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
          setCount(0);
          return;
        }
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setCount(arr.length);
        else setCount(0);
      } catch {
        setCount(0);
      }
    }
    refresh();
    window.addEventListener(eventName, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(eventName, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [storageKey, eventName]);

  if (count === 0) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-yge-blue-300 bg-yge-blue-50 px-2 py-0.5 text-xs font-semibold text-yge-blue-700 print:hidden">
      📌 {count}
    </span>
  );
}
