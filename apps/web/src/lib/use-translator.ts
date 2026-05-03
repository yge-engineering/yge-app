// Client-side translator hook.
//
// Server components use getTranslator() from ./locale.ts (which reads
// the cookie via next/headers). Client components can't use that —
// next/headers is server-only. This hook reads the same cookie via
// document.cookie and returns a translator pre-bound to the active
// locale.
//
// Why a hook instead of a global: locale switches via the
// LocaleSwitcher trigger a router refresh, which re-runs server
// components but client islands stay mounted. Reading the cookie on
// every render keeps the in-page text in sync with whatever the user
// just picked, without requiring the page to remount.

'use client';

import { coerceLocale, makeTranslator, SEED_DICTIONARY, type Locale } from '@yge/shared';
import type { Translator } from './locale';

const COOKIE_NAME = 'yge-locale';

function readLocaleCookie(): Locale {
  if (typeof document === 'undefined') return coerceLocale(undefined);
  const cookies = document.cookie.split(';');
  for (const c of cookies) {
    const [k, ...rest] = c.trim().split('=');
    if (k === COOKIE_NAME) {
      return coerceLocale(rest.join('='));
    }
  }
  return coerceLocale(undefined);
}

/**
 * Client-side hook that returns a translator pre-bound to the locale
 * from the cookie. Use it from `'use client'` components.
 */
export function useTranslator(): Translator {
  const locale = readLocaleCookie();
  return makeTranslator(SEED_DICTIONARY, locale);
}

/**
 * Client-side hook that returns just the active Locale. Use this when
 * a component needs to pass the locale into a helper that itself takes
 * a locale arg (e.g. `statusLabel(s, locale)` for enum labels). Reading
 * the same cookie that useTranslator uses keeps the page in sync.
 */
export function useLocale(): Locale {
  return readLocaleCookie();
}

export type { Translator };
