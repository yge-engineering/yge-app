// AsyncStorage-backed locale preference for the mobile app.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LOCALE, type Locale } from '@yge/shared';

const KEY = 'yge.mobile.locale';

export async function readLocale(): Promise<Locale> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === 'en' || raw === 'es') return raw;
  } catch {}
  return DEFAULT_LOCALE;
}

export async function writeLocale(locale: Locale): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, locale);
  } catch {}
}
