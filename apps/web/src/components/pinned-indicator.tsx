'use client';

// Renders 📌 inline if the given id is pinned per the localStorage key.

import { useEffect, useState } from 'react';

interface Props {
  storageKey: string;
  eventName: string;
  id: string;
}

export function PinnedIndicator({ storageKey, eventName, id }: Props) {
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    function refresh() {
      if (typeof window === 'undefined') return;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
          setPinned(false);
          return;
        }
        const arr = JSON.parse(raw);
        setPinned(Array.isArray(arr) && arr.includes(id));
      } catch {
        setPinned(false);
      }
    }
    refresh();
    window.addEventListener(eventName, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(eventName, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [storageKey, eventName, id]);

  if (!pinned) return null;
  return (
    <span className="mr-1 text-xs text-yge-blue-700 print:hidden" title="Pinned to top of /estimates">
      📌
    </span>
  );
}
