// Bid-tabs by-month inline sparkline.
//
// A compact bar chart of how many tabs were imported per
// bid-open month over the last 12 months. Lets the operator
// eyeball the corpus density at a glance — has anyone been
// keeping up with imports? Are we covering the agencies that
// matter? Pure inline SVG (no chart library) so no new deps.

import { getTranslator } from '../lib/locale';

interface Props {
  bidOpenedAtIsoDates: string[];
  /** Number of months to display, ending on the most recent
   *  full month. Default 12. */
  monthCount?: number;
}

interface MonthBucket {
  /** YYYY-MM */
  ym: string;
  count: number;
}

function buildBuckets(dates: string[], monthCount: number): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = monthCount - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getUTCFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ ym, count: 0 });
  }
  const idxByYm = new Map(buckets.map((b, i) => [b.ym, i]));
  for (const iso of dates) {
    const ym = iso.slice(0, 7);
    const idx = idxByYm.get(ym);
    if (idx !== undefined) {
      const bucket = buckets[idx];
      if (bucket) bucket.count += 1;
    }
  }
  return buckets;
}

export function BidTabsMonthSparkline({ bidOpenedAtIsoDates, monthCount = 12 }: Props) {
  const buckets = buildBuckets(bidOpenedAtIsoDates, monthCount);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const t = getTranslator();
  const w = 320;
  const h = 56;
  const barWidth = w / buckets.length - 2;

  return (
    <div className="flex items-end gap-2">
      <svg width={w} height={h} className="overflow-visible" role="img" aria-label={t('sparkline.aria')}>
        {buckets.map((b, i) => {
          const barH = (b.count / max) * (h - 12);
          const x = i * (w / buckets.length) + 1;
          const y = h - barH;
          return (
            <g key={b.ym}>
              <rect
                x={x}
                y={y}
                width={Math.max(barWidth, 4)}
                height={Math.max(barH, b.count > 0 ? 2 : 0)}
                fill={b.count > 0 ? '#2563eb' : '#e5e7eb'}
                rx={2}
              >
                <title>{b.count === 1 ? t('sparkline.tooltipOne', { ym: b.ym }) : t('sparkline.tooltipMany', { ym: b.ym, count: b.count })}</title>
              </rect>
              {b.count > 0 && (
                <text
                  x={x + Math.max(barWidth, 4) / 2}
                  y={y - 2}
                  textAnchor="middle"
                  className="fill-gray-700"
                  style={{ fontSize: 9 }}
                >
                  {b.count}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="text-[10px] text-gray-500">
        <div>{buckets[0]?.ym ?? ''}</div>
        <div>→ {buckets[buckets.length - 1]?.ym ?? ''}</div>
        <div className="mt-1 font-mono text-gray-700">
          {t('sparkline.peak', { n: max })}
        </div>
      </div>
    </div>
  );
}
