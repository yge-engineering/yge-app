// Forecast strip — 7-day weather forecast tiles.
//
// Plain English: a horizontal row of tiles, one per daytime period
// (Today, Tomorrow, Sat, Sun, Mon, Tue, Wed). Each shows temperature,
// short forecast (Sunny / Mostly Cloudy / etc.), wind, and chance of
// rain. Pulled from the National Weather Service so it's free and
// reliable for any US location. Sits at the top of /weather above the
// existing manual log table.
//
// Server component — pure render of data passed in as a prop.

import type { NwsForecast } from '../lib/nws';

interface Props {
  forecast: NwsForecast | null;
  /** Where the forecast is for. Shows in the header so users know
   *  which jobsite this is. Defaults to YGE HQ. */
  locationLabel?: string;
}

export function ForecastStrip({
  forecast,
  locationLabel = 'Cottonwood, CA (YGE HQ)',
}: Props) {
  if (!forecast || forecast.periods.length === 0) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
        Forecast unavailable right now. (NWS feed may be down — try
        refreshing.)
      </section>
    );
  }

  // Show the next ~7 daytime periods. NWS interleaves daytime + overnight;
  // pick daytime ones first, then if not enough, include overnight too.
  const daytimes = forecast.periods.filter((p) => p.isDaytime).slice(0, 7);
  const tiles = daytimes.length > 0 ? daytimes : forecast.periods.slice(0, 7);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">
          7-day forecast — {locationLabel}
        </h2>
        <p className="text-[11px] text-gray-500">
          Source: National Weather Service
          {forecast.updatedAt && (
            <>
              {' · '}updated{' '}
              {new Date(forecast.updatedAt).toLocaleString('en-US', {
                timeZone: forecast.timeZone,
                weekday: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </>
          )}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map((p) => (
          <div
            key={p.number}
            className="rounded-md border border-gray-200 p-2 text-center"
          >
            <div className="text-xs font-semibold text-gray-700">{p.name}</div>
            {p.icon && (
              <img
                src={p.icon}
                alt={p.shortForecast}
                className="mx-auto my-1 h-12 w-12 rounded"
              />
            )}
            <div
              className={`text-2xl font-bold ${p.isDaytime ? 'text-gray-900' : 'text-gray-600'}`}
            >
              {p.temperature}°{p.temperatureUnit}
            </div>
            <div className="mt-1 text-[11px] leading-tight text-gray-600">
              {p.shortForecast}
            </div>
            <div className="mt-1 text-[10px] text-gray-500">
              {p.windDirection} {p.windSpeed}
            </div>
            {typeof p.probabilityOfPrecipitation === 'number' &&
              p.probabilityOfPrecipitation > 0 && (
                <div className="mt-0.5 text-[10px] font-medium text-blue-700">
                  {p.probabilityOfPrecipitation}% rain
                </div>
              )}
          </div>
        ))}
      </div>
    </section>
  );
}
