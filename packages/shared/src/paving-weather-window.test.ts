// Coverage for the AC paving weather-window rule engine.

import { describe, it, expect } from 'vitest';
import {
  checkPavingWeather,
  pavingWeatherVerdict,
} from './paving-weather-window';

describe('checkPavingWeather', () => {
  it('allows on a fine day', () => {
    const r = checkPavingWeather({
      date: '2026-08-15',
      lift: 'SURFACE',
      surfaceTempF: 78,
      surfaceIsWet: false,
      hoursToForecastRain: 999,
      sustainedWindMph: 8,
    });
    expect(r.allowed).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('binder course passes at 52°F (only needs 50)', () => {
    const r = checkPavingWeather({
      date: '2026-09-01',
      lift: 'BINDER',
      surfaceTempF: 52,
      surfaceIsWet: false,
      hoursToForecastRain: 999,
      sustainedWindMph: 5,
    });
    expect(r.allowed).toBe(true);
  });

  it('surface course at 52°F fails (needs 60)', () => {
    const r = checkPavingWeather({
      date: '2026-09-01',
      lift: 'SURFACE',
      surfaceTempF: 52,
      surfaceIsWet: false,
      hoursToForecastRain: 999,
      sustainedWindMph: 5,
    });
    expect(r.allowed).toBe(false);
    expect(r.issues).toContain('SURFACE_TOO_COLD');
    expect(r.explanations[0]).toContain('60°F');
  });

  it('wet surface blocks any lift', () => {
    const r = checkPavingWeather({
      date: '2026-04-20',
      lift: 'BINDER',
      surfaceTempF: 65,
      surfaceIsWet: true,
      hoursToForecastRain: 999,
      sustainedWindMph: 5,
    });
    expect(r.allowed).toBe(false);
    expect(r.issues).toContain('SURFACE_WET');
  });

  it('rain forecast inside 4 hours blocks paving', () => {
    const r = checkPavingWeather({
      date: '2026-04-20',
      lift: 'SURFACE',
      surfaceTempF: 72,
      surfaceIsWet: false,
      hoursToForecastRain: 2.5,
      sustainedWindMph: 5,
    });
    expect(r.allowed).toBe(false);
    expect(r.issues).toContain('RAIN_SOON');
    expect(r.explanations.find((e) => e.includes('2.5'))).toBeDefined();
  });

  it('rain forecast exactly at 4 hours does NOT block (boundary)', () => {
    const r = checkPavingWeather({
      date: '2026-04-20',
      lift: 'SURFACE',
      surfaceTempF: 72,
      surfaceIsWet: false,
      hoursToForecastRain: 4,
      sustainedWindMph: 5,
    });
    expect(r.allowed).toBe(true);
  });

  it('wind > 30 mph blocks paving', () => {
    const r = checkPavingWeather({
      date: '2026-03-10',
      lift: 'SURFACE',
      surfaceTempF: 70,
      surfaceIsWet: false,
      hoursToForecastRain: 999,
      sustainedWindMph: 35,
    });
    expect(r.allowed).toBe(false);
    expect(r.issues).toContain('WIND_TOO_HIGH');
  });

  it('stacks multiple issues with one explanation per issue', () => {
    const r = checkPavingWeather({
      date: '2026-01-15',
      lift: 'SURFACE',
      surfaceTempF: 42,
      surfaceIsWet: true,
      hoursToForecastRain: 1,
      sustainedWindMph: 35,
    });
    expect(r.allowed).toBe(false);
    expect(r.issues).toEqual([
      'SURFACE_TOO_COLD',
      'SURFACE_WET',
      'RAIN_SOON',
      'WIND_TOO_HIGH',
    ]);
    expect(r.explanations).toHaveLength(4);
  });
});

describe('pavingWeatherVerdict', () => {
  it('one-liner OK on a good day', () => {
    const s = pavingWeatherVerdict({
      date: '2026-08-15',
      lift: 'BINDER',
      surfaceTempF: 72,
      surfaceIsWet: false,
      hoursToForecastRain: 999,
      sustainedWindMph: 8,
    });
    expect(s).toContain('weather OK');
    expect(s).toContain('binder');
  });

  it('one-liner enumerates blockers', () => {
    const s = pavingWeatherVerdict({
      date: '2026-01-15',
      lift: 'SURFACE',
      surfaceTempF: 42,
      surfaceIsWet: true,
      hoursToForecastRain: 1,
      sustainedWindMph: 35,
    });
    expect(s).toContain('NO PAVE');
    expect(s).toContain('4 blockers');
    expect(s).toContain('SURFACE_TOO_COLD');
  });
});
