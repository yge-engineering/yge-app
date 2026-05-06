/** "Just now" / "5m ago" / "Yesterday" / "3d ago" / "2w ago" / "5mo ago" / "3y ago".
 *  Falls back to the original ISO string when unparseable. */
export type RelativeLocale = 'en' | 'es';

const STRINGS: Record<RelativeLocale, {
  future: string;
  justNow: string;
  yesterday: string;
  m: (n: number) => string;
  h: (n: number) => string;
  d: (n: number) => string;
  w: (n: number) => string;
  mo: (n: number) => string;
  y: (n: number) => string;
}> = {
  en: {
    future: 'in the future',
    justNow: 'just now',
    yesterday: 'Yesterday',
    m: (n) => `${n}m ago`,
    h: (n) => `${n}h ago`,
    d: (n) => `${n}d ago`,
    w: (n) => `${n}w ago`,
    mo: (n) => `${n}mo ago`,
    y: (n) => `${n}y ago`,
  },
  es: {
    future: 'en el futuro',
    justNow: 'ahora',
    yesterday: 'Ayer',
    m: (n) => `hace ${n}m`,
    h: (n) => `hace ${n}h`,
    d: (n) => `hace ${n}d`,
    w: (n) => `hace ${n}sem`,
    mo: (n) => `hace ${n}me`,
    y: (n) => `hace ${n}a`,
  },
};

export function relativeTime(iso: string, locale: RelativeLocale = 'en'): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const L = STRINGS[locale];
  if (diff < 0) return L.future;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return L.justNow;
  if (minutes < 60) return L.m(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const now = new Date();
    const then = new Date(t);
    if (
      now.getFullYear() === then.getFullYear() &&
      now.getMonth() === then.getMonth() &&
      now.getDate() === then.getDate()
    ) {
      return L.h(hours);
    }
    return L.yesterday;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return L.yesterday;
  if (days < 7) return L.d(days);
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return L.w(weeks);
  const months = Math.floor(days / 30);
  if (months < 12) return L.mo(months);
  const years = Math.floor(days / 365);
  return L.y(years);
}
