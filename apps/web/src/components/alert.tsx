// Alert — banner / inline notice with semantic tone.
//
// Plain English: the red-bordered "OUT OF BALANCE" banners,
// amber-bordered "missing rate" warnings, green-bordered "all caught
// up" confirmations have been hand-rolled across ~10 pages with
// `<Card className="border-red-300 bg-red-50">…</Card>`. This
// centralises that pattern with a single tone prop.

import type React from 'react';

import type { TileTone } from './tile';

export type AlertTone = TileTone | 'info';

interface Props {
  tone?: AlertTone;
  /** Optional title shown bold on the first line. */
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Render as a small inline notice (no padding heavy) instead of
   * a full banner card. */
  compact?: boolean;
}

const TONE_CLASS: Record<AlertTone, { border: string; bg: string; text: string }> = {
  neutral: { border: 'border-gray-300', bg: 'bg-gray-50', text: 'text-gray-900' },
  success: { border: 'border-emerald-300', bg: 'bg-emerald-50', text: 'text-emerald-900' },
  warn: { border: 'border-amber-300', bg: 'bg-amber-50', text: 'text-amber-900' },
  danger: { border: 'border-red-300', bg: 'bg-red-50', text: 'text-red-900' },
  info: { border: 'border-blue-300', bg: 'bg-blue-50', text: 'text-blue-900' },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  compact,
}: Props) {
  const t = TONE_CLASS[tone];
  return (
    <div
      role="status"
      className={`rounded-md border ${t.border} ${t.bg} ${t.text} ${compact ? 'px-3 py-2 text-xs' : 'p-3 text-sm'} ${className ?? ''}`}
    >
      {title ? <div className="font-semibold">{title}</div> : null}
      <div className={title ? 'mt-1' : ''}>{children}</div>
    </div>
  );
}
