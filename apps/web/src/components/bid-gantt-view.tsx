// Bid-schedule Gantt view — horizontal bar chart rendered in plain
// CSS (no chart library). Runs buildBidGantt over the draft's bid
// items + site condition and lays out one row per task, grouped by
// trade.
//
// Server-component friendly: pure props in, pure JSX out.

import type { PtoEOutput } from '@yge/shared';
import {
  buildBidGantt,
  GANTT_GROUP_LABEL,
  type GanttGroup,
} from '@yge/shared';

interface Props {
  draft: PtoEOutput;
}

const GROUP_TONE: Record<GanttGroup, string> = {
  MOB: 'bg-gray-500',
  CLEARING: 'bg-lime-500',
  EARTHWORK: 'bg-amber-600',
  UTILITY: 'bg-sky-600',
  CONCRETE: 'bg-stone-500',
  STRUCTURE: 'bg-indigo-600',
  PAVING: 'bg-slate-800',
  STRIPING: 'bg-yellow-500',
  FENCE: 'bg-emerald-600',
  EROSION_CONTROL: 'bg-green-600',
  DEMOB: 'bg-gray-500',
  OTHER: 'bg-purple-500',
};

export function BidGanttView({ draft }: Props) {
  const gantt = buildBidGantt({
    bidItems: draft.bidItems,
    siteCondition: draft.siteCondition,
  });

  if (gantt.tasks.length === 0 || gantt.totalDays === 0) {
    return null;
  }

  // Working days → calendar weeks for the axis label (5 work days /
  // week assumption).
  const totalWeeks = Math.ceil(gantt.totalDays / 5);

  return (
    <div className="rounded-md border border-gray-200 bg-white shadow-sm">
      <header className="border-b border-gray-100 bg-gray-50 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          Schedule — bar chart from NTP
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Bars derived from production rates × quantities ×{' '}
          {draft.siteCondition ? draft.siteCondition.replace(/_/g, ' ').toLowerCase() : 'unknown'}{' '}
          multiplier. Items in the same trade group can parallelize; trade groups
          sequence after each other. Critical-path bars are darker.
        </p>
        <p className="mt-1 text-xs text-gray-700">
          Total ≈ <span className="font-semibold">{gantt.totalDays} workdays</span> ({totalWeeks} weeks).
        </p>
      </header>
      <div className="overflow-x-auto p-3">
        <div className="min-w-[640px]">
          <GanttAxis totalDays={gantt.totalDays} />
          <div className="mt-2 space-y-3">
            {gantt.groupSpans.map((span) => {
              const tasksInGroup = gantt.tasks.filter((t) => t.group === span.group);
              return (
                <div key={span.group}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                    {GANTT_GROUP_LABEL[span.group]}
                    <span className="ml-2 text-[10px] font-normal lowercase tracking-normal text-gray-500">
                      day {span.startDay}–{span.endDay} · {span.endDay - span.startDay} workdays
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {tasksInGroup.map((t, idx) => {
                      const leftPct = (t.startDay / gantt.totalDays) * 100;
                      const widthPct =
                        ((t.endDay - t.startDay) / gantt.totalDays) * 100;
                      const tone = GROUP_TONE[t.group];
                      const opacity = t.onCriticalPath ? 'opacity-100' : 'opacity-60';
                      return (
                        <div
                          key={`${span.group}-${t.itemNumber}-${idx}`}
                          className="relative flex h-5 items-center"
                          title={`${t.description} · ${t.quantity.toLocaleString()} ${t.unit} · ${t.durationDays}d${t.onCriticalPath ? ' (critical path)' : ''}${t.rateNote ? ` · ${t.rateNote}` : ''}`}
                        >
                          <div
                            className={`absolute top-0 h-5 rounded ${tone} ${opacity}`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${Math.max(widthPct, 0.5)}%`,
                            }}
                          />
                          <div className="relative ml-2 truncate text-[11px] text-gray-700">
                            #{t.itemNumber} {t.description}
                            <span className="ml-1 text-gray-400">
                              · {t.durationDays}d
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Top-of-chart axis with week tick marks. */
function GanttAxis({ totalDays }: { totalDays: number }) {
  const weeks = Math.ceil(totalDays / 5);
  return (
    <div className="relative h-5 border-b border-gray-200">
      {Array.from({ length: weeks + 1 }, (_, i) => {
        const day = i * 5;
        const leftPct = (day / totalDays) * 100;
        if (leftPct > 100) return null;
        return (
          <div
            key={i}
            className="absolute top-0 -translate-x-1/2 text-[10px] text-gray-500"
            style={{ left: `${leftPct}%` }}
          >
            {i === 0 ? 'NTP' : `wk ${i}`}
          </div>
        );
      })}
    </div>
  );
}
