// Tile — single KPI display.
//
// Plain English: a small card showing a metric — label on top, big
// number below. Optional tone tints the border/background so a "bad"
// number stands out. Used in dashboard tile boards and detail-page
// summary strips.

import Link from 'next/link';

export type TileTone = 'neutral' | 'success' | 'warn' | 'danger';

interface Props {
  label: string;
  value: number | string;
  /** Optional sublabel (e.g. '12 vendors', 'over 90 days'). */
  sublabel?: string;
  /** Optional href — turns the whole tile into a link. */
  href?: string;
  /** Color tone for the tile (border + bg + value text). */
  tone?: TileTone;
  /** DEPRECATED: legacy warn boolean — equivalent to tone="danger". */
  warn?: boolean;
  /** Small caption shown under the value (red on warn/danger). */
  warnText?: string;
}

const TONE_BORDER: Record<TileTone, string> = {
  neutral: 'border-gray-200',
  success: 'border-emerald-200',
  warn: 'border-amber-300',
  danger: 'border-red-300',
};

const TONE_BG: Record<TileTone, string> = {
  neutral: 'bg-white',
  success: 'bg-emerald-50',
  warn: 'bg-amber-50',
  danger: 'bg-red-50',
};

const TONE_VALUE: Record<TileTone, string> = {
  neutral: 'text-gray-900',
  success: 'text-emerald-800',
  warn: 'text-amber-800',
  danger: 'text-red-700',
};

export function Tile({ label, value, sublabel, href, tone, warn, warnText }: Props) {
  const effectiveTone: TileTone = tone ?? (warn ? 'danger' : 'neutral');
  const Inner = (
    <div
      className={`rounded-md border p-4 transition ${TONE_BORDER[effectiveTone]} ${TONE_BG[effectiveTone]} ${href ? 'hover:border-blue-500 hover:shadow-sm' : ''}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${TONE_VALUE[effectiveTone]}`}>{value}</div>
      {sublabel ? <div className="mt-1 text-xs text-gray-500">{sublabel}</div> : null}
      {warnText ? (
        <div className={`mt-1 text-xs font-medium ${effectiveTone === 'danger' ? 'text-red-700' : effectiveTone === 'warn' ? 'text-amber-800' : 'text-gray-500'}`}>
          {warnText}
        </div>
      ) : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {Inner}
      </Link>
    );
  }
  return Inner;
}
