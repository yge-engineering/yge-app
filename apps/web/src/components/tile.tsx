// Tile — single KPI display.
//
// Plain English: a small card showing a metric — label on top, big
// number below, optional warn-text in red when the value crosses a
// threshold. Used in dashboard tile boards and detail-page summary
// strips.

import Link from 'next/link';

interface Props {
  label: string;
  value: number | string;
  /** Optional sublabel (e.g. '12 vendors', 'over 90 days'). */
  sublabel?: string;
  /** Optional href — turns the whole tile into a link. */
  href?: string;
  /** Show the value in red and add a small warn caption. */
  warn?: boolean;
  warnText?: string;
}

export function Tile({ label, value, sublabel, href, warn, warnText }: Props) {
  const Inner = (
    <div
      className={`rounded-md border bg-white p-4 transition ${href ? 'hover:border-blue-500 hover:shadow-sm' : ''} ${warn ? 'border-red-300' : 'border-gray-200'}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${warn ? 'text-red-700' : 'text-gray-900'}`}>{value}</div>
      {sublabel ? <div className="mt-1 text-xs text-gray-500">{sublabel}</div> : null}
      {warn && warnText ? <div className="mt-1 text-xs font-medium text-red-700">{warnText}</div> : null}
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
