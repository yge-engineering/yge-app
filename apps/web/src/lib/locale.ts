// Server-side helpers for the active locale.
//
// The locale cookie is set by the LocaleSwitcher client island
// (POSTs to /api/locale, the route handler writes the cookie).
// Server components call getLocale() to read the cookie at render
// time and pass it into translate() / makeTranslator().
//
// When the cookie is absent or holds an unknown value, getLocale()
// falls back to the default 'en'. The Spanish-first rollout flips
// the default, then per-page strings get translated as each page
// is touched.

import { cookies } from 'next/headers';
import { coerceLocale, makeTranslator, SEED_DICTIONARY, type Locale } from '@yge/shared';

const COOKIE_NAME = 'yge-locale';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export function getLocale(): Locale {
  return coerceLocale(cookies().get(COOKIE_NAME)?.value);
}

/**
 * Convenience used by server components: pre-bound translator for
 * the current request's locale + the seeded dictionary. Pages can
 * still build their own translator against page-specific
 * dictionaries when the seed is too thin.
 */
export function getTranslator() {
  return makeTranslator(SEED_DICTIONARY, getLocale());
}

export const LOCALE_COOKIE_NAME = COOKIE_NAME;
export const LOCALE_COOKIE_MAX_AGE_SECONDS = COOKIE_MAX_AGE_SECONDS;
