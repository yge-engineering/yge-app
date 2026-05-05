// National Weather Service forecast helper.
//
// Plain English: NWS publishes a free, no-auth forecast API at
// api.weather.gov. We fetch the 7-day forecast for Cottonwood, CA
// (or wherever the caller asks) and surface it on the /weather log
// page so Ryan + Brook can see what's coming before scheduling
// crews. Refreshes every 30 min.
//
// NWS is US-only. The two-call protocol:
//   1. GET /points/{lat},{lon} returns metadata including the
//      forecast URL for that grid point.
//   2. GET <forecast_url> returns 7 days of period data (12 / 14
//      periods alternating daytime/overnight).
//
// They require a User-Agent header that identifies the app.

const YGE_LAT = 40.3852;
const YGE_LON = -122.2811;

const USER_AGENT = 'YGE App / app.youngge.com (ryoung@youngge.com)';

export interface NwsPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: 'F' | 'C';
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  icon: string;
  /** 0-100 % chance of precipitation, when published. NWS sometimes
   *  omits this. */
  probabilityOfPrecipitation?: number | null;
}

export interface NwsForecast {
  /** ISO timestamp of NWS's last update. */
  updatedAt: string;
  /** Time zone string from NWS (e.g. 'America/Los_Angeles'). */
  timeZone: string;
  /** All forecast periods returned by NWS. Typically 14 — 7 days,
   *  daytime + overnight. */
  periods: NwsPeriod[];
}

interface PointsResponseShape {
  properties?: {
    forecast?: string;
    timeZone?: string;
  };
}

interface ForecastResponseShape {
  properties?: {
    updated?: string;
    updateTime?: string;
    periods?: NwsPeriod[];
  };
}

/** Fetch the 7-day forecast for the given lat/lon (defaults to YGE
 *  HQ in Cottonwood, CA). Returns null on any failure — caller is
 *  expected to render gracefully. */
export async function fetchNwsForecast(
  lat: number = YGE_LAT,
  lon: number = YGE_LON,
): Promise<NwsForecast | null> {
  try {
    // Step 1: gridpoint lookup. Cache for an hour — the grid mapping
    // for a fixed lat/lon doesn't change often.
    const pointRes = await fetch(
      `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
        next: { revalidate: 3600 },
      },
    );
    if (!pointRes.ok) return null;
    const point = (await pointRes.json()) as PointsResponseShape;
    const forecastUrl = point.properties?.forecast;
    if (!forecastUrl) return null;

    // Step 2: actual forecast. Cache 30 min — NWS publishes updates
    // a few times a day; we don't need to be more aggressive than that.
    const fRes = await fetch(forecastUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
      next: { revalidate: 1800 },
    });
    if (!fRes.ok) return null;
    const data = (await fRes.json()) as ForecastResponseShape;
    if (!data.properties?.periods) return null;
    return {
      updatedAt: data.properties.updated ?? data.properties.updateTime ?? '',
      timeZone: point.properties?.timeZone ?? 'America/Los_Angeles',
      periods: data.properties.periods,
    };
  } catch {
    return null;
  }
}
