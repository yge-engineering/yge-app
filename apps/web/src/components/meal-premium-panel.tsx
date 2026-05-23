// Meal + rest premium-pay panel for the time-card detail page.
//
// Plain English: California Labor Code §226.7 says when an employee
// misses a compliant meal period (no meal on a >5 h shift, short
// meal under 30 min, or late meal started after the 5th hour), the
// employer owes one additional hour at the employee's regular rate.
// Same for missing rest breaks.
//
// This panel walks the time card's entries, runs each through
// calcMealRestPremium (which delegates to ca-shift-rules.evaluateShift),
// and surfaces the days where a premium is owed so the bookkeeper
// can pre-load it before payroll runs.
//
// Caveat: time-card entries only carry one meal period (lunchOut /
// lunchIn). Rest-break timestamps live on the daily-report side. So
// this panel reliably catches MEAL violations on the time card; for
// REST violations the bookkeeper should also check the daily-report
// CA-shift-rules audit panel. (TODO: a future bundle joins the two.)

import {
  calcMealRestPremium,
  totalPremium,
  type DailyPremiumRow,
  type ShiftForPremium,
  type TimeCard,
  type TimeEntry,
} from '@yge/shared';

function hhmmToMin(s: string): number {
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function entryToShiftForPremium(
  employeeId: string,
  entry: TimeEntry,
): ShiftForPremium {
  const clockIn = hhmmToMin(entry.startTime);
  let clockOut = hhmmToMin(entry.endTime);
  if (clockOut < clockIn) clockOut += 24 * 60; // crosses midnight
  const meals =
    entry.lunchOut && entry.lunchIn
      ? [
          {
            startMin: hhmmToMin(entry.lunchOut),
            endMin:
              hhmmToMin(entry.lunchIn) < hhmmToMin(entry.lunchOut)
                ? hhmmToMin(entry.lunchIn) + 24 * 60
                : hhmmToMin(entry.lunchIn),
          },
        ]
      : [];
  return {
    employeeId,
    workDate: entry.date,
    // Rests come from daily-report data, not the time card. Empty array
    // means we don't flag rest-break violations here — see panel note.
    shift: { clockInMin: clockIn, clockOutMin: clockOut, meals, rests: [] },
  };
}

export function MealPremiumPanel({ card }: { card: TimeCard }) {
  const shifts: ShiftForPremium[] = card.entries.map((e) =>
    entryToShiftForPremium(card.employeeId, e),
  );
  // Rest violations are reliably caught on the daily-report side, so we
  // disable the rest-derived rows here by stripping any that came in.
  const rows: DailyPremiumRow[] = calcMealRestPremium(shifts, {
    mode: 'CONSERVATIVE',
  }).map((r) => ({
    ...r,
    // The time card can't see rest-break gaps; suppress those flags so we
    // don't double-bill with the DR panel.
    restPremiumTriggered: false,
    premiumHours: r.mealPremiumTriggered ? 1 : 0,
    premiumCents: 0,
  }));
  const rollup = totalPremium(rows);

  if (rollup.totalDays === 0) {
    return (
      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Meal premium</h2>
        <p className="mt-2 text-sm text-gray-600">
          No meal-period violations detected on this card. Compliant.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-amber-900">
        Meal premium owed — {rollup.totalHours} hour
        {rollup.totalHours === 1 ? '' : 's'} across {rollup.totalDays} day
        {rollup.totalDays === 1 ? '' : 's'}
      </h2>
      <p className="mt-1 text-sm text-amber-900/80">
        CA Labor Code §226.7(c): one additional hour at the regular rate per
        workday a compliant meal period was missed, short (&lt;30 min), or
        late (started after the end of the 5th hour). Add the premium to
        payroll before posting this card.
      </p>
      <table className="mt-4 w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-amber-900/70">
          <tr>
            <th className="py-2">Date</th>
            <th className="py-2">Why</th>
            <th className="py-2 text-right">Premium hours</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((r) => r.premiumHours > 0)
            .map((r) => (
              <tr key={`${r.workDate}-${r.employeeId}`} className="border-t border-amber-200">
                <td className="py-2 font-medium text-amber-900">{r.workDate}</td>
                <td className="py-2 text-amber-900">
                  {r.violations
                    .filter((v) => v.code.startsWith('NO_') || v.code.startsWith('SHORT_') || v.code.startsWith('LATE_'))
                    .map((v) => v.message)
                    .join('; ') || 'Meal violation'}
                </td>
                <td className="py-2 text-right font-mono font-semibold text-amber-900">
                  {r.premiumHours}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-amber-900/60">
        Rest-break violations are not detectable on the time card alone — check
        the daily-report shift-rules panel for those.
      </p>
    </section>
  );
}
