'use client';

// Keyboard shortcuts — press `?` from anywhere to see what's available.
//
// Plain English: a tiny client component that listens for the `?` key
// (and `g d`, `g j`, etc.) and either jumps to a page or opens a help
// overlay listing the shortcuts.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslator } from '../lib/use-translator';

interface Shortcut {
  keys: string;
  labelKey: string;
  href?: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: '?', labelKey: 'kbd.show' },
  { keys: '/', labelKey: 'kbd.search' },
  { keys: 'g d', labelKey: 'kbd.dashboard', href: '/dashboard' },
  { keys: 'g j', labelKey: 'kbd.jobs', href: '/jobs' },
  { keys: 'g c', labelKey: 'kbd.customers', href: '/customers' },
  { keys: 'g v', labelKey: 'kbd.vendors', href: '/vendors' },
  { keys: 'g e', labelKey: 'kbd.employees', href: '/employees' },
  { keys: 'g x', labelKey: 'kbd.equipment', href: '/equipment' },
  { keys: 'g s', labelKey: 'kbd.searchPage', href: '/search' },
  { keys: 'g h', labelKey: 'kbd.help', href: '/help' },
  { keys: 'g a', labelKey: 'kbd.allModules', href: '/all-modules' },
  { keys: 'esc', labelKey: 'kbd.esc' },
];

export function KeyboardShortcuts() {
  const t = useTranslator();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  // Esc-hint template has an inline <span> — split-and-fill via sentinel.
  const escHintParts = useMemo(() => {
    const tpl = t('kbd.escHint', { esc: '__ESC__' });
    return tpl.split('__ESC__');
  }, [t]);

  useEffect(() => {
    let prefix: string | null = null;
    let prefixTimeout: ReturnType<typeof setTimeout> | null = null;

    function clearPrefix() {
      prefix = null;
      if (prefixTimeout) {
        clearTimeout(prefixTimeout);
        prefixTimeout = null;
      }
    }

    function onKey(e: KeyboardEvent) {
      // Ignore if typing in a form field.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      if (e.key === 'Escape') {
        setOpen(false);
        clearPrefix();
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === '/') {
        const search = document.querySelector('input[name="q"]') as HTMLInputElement | null;
        if (search) {
          e.preventDefault();
          search.focus();
        }
        return;
      }
      if (e.key === 'g' && !prefix) {
        prefix = 'g';
        prefixTimeout = setTimeout(clearPrefix, 1500);
        return;
      }
      if (prefix === 'g') {
        const target = SHORTCUTS.find((s) => s.keys === `g ${e.key}` && s.href);
        if (target?.href) {
          e.preventDefault();
          router.push(target.href);
        }
        clearPrefix();
        return;
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [router]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">{t('kbd.title')}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
            aria-label={t('kbd.close')}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M5.7 4.3 4.3 5.7 8.6 10l-4.3 4.3 1.4 1.4L10 11.4l4.3 4.3 1.4-1.4L11.4 10l4.3-4.3-1.4-1.4L10 8.6 5.7 4.3z" />
            </svg>
          </button>
        </div>
        <dl className="space-y-1.5 text-sm">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-gray-50">
              <dt className="text-gray-700">{t(s.labelKey)}</dt>
              <dd>
                {s.keys.split(' ').map((part, i) => (
                  <span key={i} className="ml-1 inline-block rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-700">
                    {part}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-center text-xs text-gray-400">
          {escHintParts[0]}
          <span className="font-mono">esc</span>
          {escHintParts[1]}
        </p>
      </div>
    </div>
  );
}
