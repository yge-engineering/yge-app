// ProgressBar — horizontal completion bar.
//
// Plain English: a thin colored bar that shows how far along something
// is. Used for job %-complete on the WIP report, retention
// outstanding-vs-released, RFI workflow position, anywhere we can
// reduce a status to "X out of Y".

import type React from 'react';

import type { TileTone } from './tile';

interface Props {
  /** Numerator. Negative numbers clamp to 0. */
  value: number;
  /** Denominator. Zero/negative clamps to 1 to avoid divide-by-zero. */
  max: number;
  /** Optional tone. Default 'info'. Danger when overage > 100% suggested. */
  tone?: TileTone | 'info';
  /** Show the percentage label at the right end of the bar. */
  showLabel?: boolean;
  /** Tailwind size class. Default h-2. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const HEIGHT_CLASS: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

const TONE_FILL: Record<NonNullable<Props['tone']>, string> = {
  neutral: 'bg-gray-500',
  success: 'bg-emerald-500',
  warn: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-600',
};

export function ProgressBar({
  value,
  max,
  tone = 'info',
  showLabel,
  size = 'md',
  className,
}: Props) {
  const safeMax = max > 0 ? max : 1;
  const safeValue = value < 0 ? 0 : value;
  const pct = (safeValue / safeMax) * 100;
  const clamped = Math.min(pct, 100);
  const overage = pct > 100;
  return (
    <span className={`block ${className ?? ''}`}>
      <span
        className={`block w-full overflow-hidden rounded-full bg-gray-200 ${HEIGHT_CLASS[size]}`}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className={`block h-full rounded-full transition-all ${overage ? TONE_FILL.danger : TONE_FILL[tone]}`}
          style={{ width: `${clamped}%` }}
        />
      </span>
      {showLabel ? (
        <span className={`mt-0.5 block text-right text-[10px] font-mono ${overage ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>
          {pct.toFixed(0)}%
        </span>
      ) : null}
    </span>
  );
}
