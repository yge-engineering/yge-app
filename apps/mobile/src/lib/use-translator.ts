import { useEffect, useState } from 'react';
import {
  DEFAULT_LOCALE,
  SEED_DICTIONARY,
  makeTranslator,
  type Locale,
} from '@yge/shared';
import { readLocale, writeLocale } from './locale-store';

type TranslatorFn = ReturnType<typeof makeTranslator>;

export function useTranslator(): {
  t: TranslatorFn;
  locale: Locale;
  setLocale: (l: Locale) => Promise<void>;
} {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    let alive = true;
    void readLocale().then((l) => {
      if (alive) setLocaleState(l);
    });
    return () => {
      alive = false;
    };
  }, []);

  const t = makeTranslator(SEED_DICTIONARY, locale);

  async function setLocale(l: Locale) {
    setLocaleState(l);
    await writeLocale(l);
  }

  return { t, locale, setLocale };
}
