// POST /api/locale — set the active locale cookie.
//
// Body: { locale: 'en' | 'es' }
// Response: { locale: 'en' | 'es' }
//
// The LocaleSwitcher client island POSTs here on click, then calls
// router.refresh() so the server re-renders against the new locale.

import { NextResponse } from 'next/server';
import { coerceLocale, isLocale } from '@yge/shared';
import {
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALE_COOKIE_NAME,
} from '@/lib/locale';

export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // empty body falls through to the default locale.
  }
  const candidate = (body as { locale?: unknown }).locale;
  if (!isLocale(candidate)) {
    return NextResponse.json(
      { error: `unsupported locale: ${String(candidate)}` },
      { status: 400 },
    );
  }
  const locale = coerceLocale(candidate);
  const res = NextResponse.json({ locale });
  res.cookies.set(LOCALE_COOKIE_NAME, locale, {
    httpOnly: false, // client reads this back to mirror the chip state
    sameSite: 'lax',
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });
  return res;
}
