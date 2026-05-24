// AC paving weather-window rule engine.
//
// Per Caltrans Std. Spec 39-3.02C(1) ("Weather Limitations") + AGC
// recommended practice for compaction:
//
//   - Surface temperature: ≥ 50°F for binder course; ≥ 60°F for the
//     final surface course (surface needs to grip + compact correctly).
//   - Surface must be DRY. No paving over a wet base — bond breaks.
//   - Forecast rain inside the next 4 hours blocks paving (the mat
//     won't cure before the rain hits).
//   - Sustained wind > 30 mph keeps the mat from holding heat — kills
//     compaction window.
//
// Inputs come from a foreman or a weather-feed integration; outputs
// are the rule engine's verdict + a plain-English explanation per
// failed rule for the daily-report editor.

export type AcLiftKind = 'BINDER' | 'SURFACE';

export interface PavingWeatherInput {
  /** Planned paving date — used only for the explanation string. */
  date: string;
  lift: AcLiftKind;
  /** Measured surface temperature in °F at start-of-shift. */
  surfaceTempF: number;
  /** True iff the existing surface is visibly wet. */
  surfaceIsWet: boolean;
  /** Hours from now until forecast rain. Use Infinity (or a big
   *  number) when no rain in the forecast. */
  hoursToForecastRain: number;
  /** Sustained wind speed in mph. */
  sustainedWindMph: number;
}

export type PavingWeatherIssue =
  | 'SURFACE_TOO_COLD'
  | 'SURFACE_WET'
  | 'RAIN_SOON'
  | 'WIND_TOO_HIGH';

export interface PavingWeatherResult {
  allowed: boolean;
  /** All failed rules, in declaration order. */
  issues: PavingWeatherIssue[];
  /** Per-issue plain English explanation, in the same order as
   *  `issues`. Goes straight into the foreman's daily-report
   *  "delay reason" field when paving has to be called off. */
  explanations: string[];
}

const RAIN_WINDOW_HOURS = 4;
const MAX_WIND_MPH = 30;

function minSurfaceTempF(lift: AcLiftKind): number {
  return lift === 'BINDER' ? 50 : 60;
}

export function checkPavingWeather(
  input: PavingWeatherInput,
): PavingWeatherResult {
  const issues: PavingWeatherIssue[] = [];
  const explanations: string[] = [];

  const minTemp = minSurfaceTempF(input.lift);
  if (input.surfaceTempF < minTemp) {
    issues.push('SURFACE_TOO_COLD');
    explanations.push(
      `Surface temp ${input.surfaceTempF}°F below the ${minTemp}°F minimum for ${input.lift === 'BINDER' ? 'binder' : 'surface'} course (Caltrans 39-3.02C(1)).`,
    );
  }

  if (input.surfaceIsWet) {
    issues.push('SURFACE_WET');
    explanations.push(
      'Existing surface is wet — bond between courses will fail. Paving must be over a dry base.',
    );
  }

  if (input.hoursToForecastRain < RAIN_WINDOW_HOURS) {
    issues.push('RAIN_SOON');
    explanations.push(
      `Rain forecast within ${input.hoursToForecastRain.toFixed(1)} hours — mat will not cure before precipitation hits (need ≥ ${RAIN_WINDOW_HOURS} hr window).`,
    );
  }

  if (input.sustainedWindMph > MAX_WIND_MPH) {
    issues.push('WIND_TOO_HIGH');
    explanations.push(
      `Sustained wind ${input.sustainedWindMph} mph above the ${MAX_WIND_MPH} mph threshold — mat loses heat too fast for compaction.`,
    );
  }

  return {
    allowed: issues.length === 0,
    issues,
    explanations,
  };
}

/** Convenience: short one-line "go / no-go" string for a tile UI. */
export function pavingWeatherVerdict(input: PavingWeatherInput): string {
  const r = checkPavingWeather(input);
  if (r.allowed) return `${input.date}: weather OK to pave (${input.lift.toLowerCase()}).`;
  return `${input.date}: NO PAVE — ${r.issues.length} blocker${r.issues.length === 1 ? '' : 's'} (${r.issues.join(', ')}).`;
}
