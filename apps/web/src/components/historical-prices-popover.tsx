'use client';

// Historical-prices popover.
//
// Plain English: each bid item row gets a tiny "🕐 History" chip.
// Click it and we look back across every priced estimate on file
// for lines that look like this one (description match, same unit
// preferred, same project type preferred). The estimator sees a
// list of "you bid this for $X.XX on the Anderson Creek job in May
// 2025" matches, with one click to copy that price into the
// current row.
//
// Why this matters: the single biggest "wait, what did we bid
// last time?" moment in heavy-civil estimating. Excel can't do
// this without manual workbook hopping.

import { useEffect, useState } from 'react';
import { formatUSD } from '@yge/shared';

interface HistoricalMatch {
  estimateId: string;
  projectName: string;
  projectType: string;
  bidDueDate?: string;
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: string;
}

interface Props {
  apiBaseUrl: string;
  description: string;
  unit: string;
  projectType: string;
  excludeEstimateId: string;
  /** Apply a chosen price to the current row. */
  onPick: (cents: number) => void;
  /** Close the popover (the parent owns the open/closed state). */
  onClose: () => void;
}

export function HistoricalPricesPopover({
  apiBaseUrl,
  description,
  unit,
  projectType,
  excludeEstimateId,
  onPick,
  onClose,
}: Props) {
  const [matches, setMatches] = useState<HistoricalMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const url = new URL(
          `${apiBaseUrl}/api/priced-estimates/historical-prices`,
        );
        url.searchParams.set('description', description);
        url.searchParams.set('unit', unit);
        url.searchParams.set('projectType', projectType);
        url.searchParams.set('excludeEstimateId', excludeEstimateId);
        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { matches: HistoricalMatch[] };
        if (!cancelled) setMatches(json.matches);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Lookup failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, description, unit, projectType, excludeEstimateId]);

  return (
    <div className="absolute right-0 top-full z-30 mt-1 w-[28rem] rounded-md border border-gray-300 bg-white shadow-xl">
      <header className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <div className="text-xs">
          <div className="font-semibold text-gray-900">Past prices</div>
          <div className="text-[10px] text-gray-500">
            Looking for "{description.slice(0, 40)}
            {description.length > 40 ? '…' : ''}" / {unit}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-900"
        >
          ✕
        </button>
      </header>
      <div className="max-h-80 overflow-y-auto text-xs">
        {matches === null && !error && (
          <div className="px-3 py-3 italic text-gray-400">Searching…</div>
        )}
        {error && (
          <div className="px-3 py-3 text-red-700">⚠ {error}</div>
        )}
        {matches && matches.length === 0 && (
          <div className="px-3 py-3 italic text-gray-400">
            No similar lines on past estimates.
          </div>
        )}
        {matches && matches.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {matches.map((m) => (
              <li
                key={`${m.estimateId}-${m.itemNumber}`}
                className="px-3 py-2 hover:bg-yge-blue-50/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-gray-900">
                      {m.projectName}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {m.projectType.replace(/_/g, ' ')} ·{' '}
                      {m.bidDueDate ?? m.createdAt.slice(0, 10)}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-gray-700">
                      Item {m.itemNumber}: {m.description}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold text-gray-900">
                      {formatUSD(m.unitPriceCents)}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      / {m.unit} · {m.quantity.toLocaleString()} bid
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(m.unitPriceCents);
                        onClose();
                      }}
                      className="mt-1 rounded border border-yge-blue-500 px-2 py-0.5 text-[10px] font-semibold text-yge-blue-700 hover:bg-yge-blue-50"
                    >
                      Use this price →
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
