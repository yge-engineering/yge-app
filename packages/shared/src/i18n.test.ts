import { describe, expect, it } from 'vitest';
import {
  SEED_DICTIONARY,
  coerceLocale,
  isLocale,
  localeLabel,
  makeTranslator,
  translate,
  type DictionaryByLocale,
} from './i18n';

describe('isLocale + coerceLocale', () => {
  it('accepts en + es', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('es')).toBe(true);
  });
  it('rejects unknowns', () => {
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(123)).toBe(false);
  });
  it('coerces unknowns to default en', () => {
    expect(coerceLocale('fr')).toBe('en');
    expect(coerceLocale(undefined)).toBe('en');
    expect(coerceLocale('es')).toBe('es');
  });
});

describe('translate', () => {
  const dict: DictionaryByLocale = {
    en: {
      'hello': 'Hello',
      'greet': 'Hello, {name}',
      'plural': '{count} thing{plural}',
    },
    es: {
      'hello': 'Hola',
      'greet': 'Hola, {name}',
    },
  };

  it('returns the localized string', () => {
    expect(translate(dict, 'es', 'hello')).toBe('Hola');
  });

  it('falls back to English when the requested locale is missing the key', () => {
    expect(translate(dict, 'es', 'plural')).toBe('{count} thing{plural}');
  });

  it('returns the raw key when neither locale has it', () => {
    expect(translate(dict, 'en', 'missing.key')).toBe('missing.key');
  });

  it('interpolates vars', () => {
    expect(translate(dict, 'en', 'greet', { name: 'Ryan' })).toBe('Hello, Ryan');
  });

  it('leaves placeholders for missing vars', () => {
    expect(translate(dict, 'en', 'greet', {})).toBe('Hello, {name}');
  });
});

describe('localeLabel', () => {
  it('returns English / Español', () => {
    expect(localeLabel('en')).toBe('English');
    expect(localeLabel('es')).toBe('Español');
  });
});

describe('makeTranslator', () => {
  it('binds dict + locale', () => {
    const t = makeTranslator(SEED_DICTIONARY, 'es');
    expect(t('common.save')).toBe('Guardar');
    expect(t('common.cancel')).toBe('Cancelar');
  });
});

describe('SEED_DICTIONARY', () => {
  it('every English key has a Spanish equivalent', () => {
    const enKeys = Object.keys(SEED_DICTIONARY.en);
    const missing = enKeys.filter((k) => SEED_DICTIONARY.es[k] == null);
    expect(missing).toEqual([]);
  });
});
