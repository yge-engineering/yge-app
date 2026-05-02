// Locale switcher chip. Two pill buttons (English / Español).
// Sets the locale cookie via /api/locale, then refreshes the
// server-rendered tree.

'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { localeLabel, SUPPORTED_LOCALES, type Locale } from '@yge/shared';

interface Props {
  current: Locale;
}

export function LocaleSwitcher({ current }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<Locale>(current);
  const [busy, setBusy] = useState<Locale | null>(null);
  const [, startTransition] = useTransition();

  async function setLocale(next: Locale) {
    if (next === active || busy) return;
    setBusy(next);
    try {
      const res = await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      });
      if (!res.ok) return;
      setActive(next);
      startTransition(() => router.refresh());
    } catch {
      // swallow — the chip just won't flip
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white p-0.5 text-xs">
      {SUPPORTED_LOCALES.map((l) => {
        const isActive = l === active;
        const isBusy = busy === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            disabled={isActive || busy != null}
            aria-pressed={isActive}
            className={`rounded px-2 py-0.5 font-medium transition ${
              isActive
                ? 'bg-yge-blue-500 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {isBusy ? '…' : localeLabel(l)}
          </button>
        );
      })}
    </div>
  );
}
