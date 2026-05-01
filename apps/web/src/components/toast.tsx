'use client';

// Toast — transient notification banner.
//
// Plain English: a little success/error message that pops up in the
// top-right corner after an action finishes (saved, deleted,
// approved, etc.) and fades away. Used for non-blocking confirmations
// — destructive actions still get a real confirmation modal.

import { useEffect, useState } from 'react';

interface ToastMessage {
  id: number;
  variant: 'success' | 'error' | 'info';
  text: string;
}

let listeners: Array<(t: ToastMessage) => void> = [];
let nextId = 1;

/** Call from anywhere to show a toast. */
export function showToast(text: string, variant: ToastMessage['variant'] = 'info') {
  const t: ToastMessage = { id: nextId++, variant, text };
  listeners.forEach((l) => l(t));
}

/** Mount this once near the root of the app. */
export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    function add(t: ToastMessage) {
      setToasts((cur) => [...cur, t]);
      window.setTimeout(() => {
        setToasts((cur) => cur.filter((x) => x.id !== t.id));
      }, 4000);
    }
    listeners.push(add);
    return () => {
      listeners = listeners.filter((l) => l !== add);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto rounded-md border px-4 py-2.5 text-sm shadow-lg ${toneClass(t.variant)}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

function toneClass(v: ToastMessage['variant']): string {
  switch (v) {
    case 'success': return 'border-green-300 bg-green-50 text-green-900';
    case 'error':   return 'border-red-300 bg-red-50 text-red-900';
    default:        return 'border-blue-300 bg-blue-50 text-blue-900';
  }
}
