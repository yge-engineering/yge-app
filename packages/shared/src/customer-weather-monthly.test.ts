import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { WeatherLog } from './weather-log';

import { buildCustomerWeatherMonthly } from './customer-weather-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'AWARDED',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

function w(over: Partial<WeatherLog>): WeatherLog {
  return {
    id: 'w-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    observedOn: '2026-04-15',
    primaryCondition: 'HEAVY_RAIN',
    impact: 'STOPPED',
    lostHours: 4,
    ...over,
  } as WeatherLog;
}

describe('buildCustomerWeatherMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerWeatherMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      weatherLogs: [
        w({ id: 'a', jobId: 'j1', observedOn: '2026-04-15' }),
        w({ id: 'b', jobId: 'j2', observedOn: '2026-04-15' }),
        w({ id: 'c', jobId: 'j1', observedOn: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums lost hours', () => {
    const r = buildCustomerWeatherMonthly({
      jobs: [job({ id: 'j1' })],
      weatherLogs: [
        w({ id: 'a', lostHours: 4 }),
        w({ id: 'b', lostHours: 2 }),
      ],
    });
    expect(r.rows[0]?.totalLostHours).toBe(6);
  });

  it('breaks down by condition', () => {
    const r = buildCustomerWeatherMonthly({
      jobs: [job({ id: 'j1' })],
      weatherLogs: [
        w({ id: 'a', primaryCondition: 'HEAVY_RAIN' }),
        w({ id: 'b', primaryCondition: 'WIND' }),
        w({ id: 'c', primaryCondition: 'HEAVY_RAIN' }),
      ],
    });
    expect(r.rows[0]?.byCondition.HEAVY_RAIN).toBe(2);
    expect(r.rows[0]?.byCondition.WIND).toBe(1);
  });

  it('counts distinct jobs', () => {
    const r = buildCustomerWeatherMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'Caltrans D2' }),
      ],
      weatherLogs: [
        w({ id: 'a', jobId: 'j1' }),
        w({ id: 'b', jobId: 'j2' }),
        w({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('counts unattributed (no matching job)', () => {
    const r = buildCustomerWeatherMonthly({
      jobs: [job({ id: 'j1' })],
      weatherLogs: [
        w({ id: 'a', jobId: 'j1' }),
        w({ id: 'b', jobId: 'orphan' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerWeatherMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      weatherLogs: [
        w({ id: 'old', observedOn: '2026-03-15' }),
        w({ id: 'in', observedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalEntries).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerWeatherMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      weatherLogs: [
        w({ id: 'a', jobId: 'jZ', observedOn: '2026-04-15' }),
        w({ id: 'b', jobId: 'jA', observedOn: '2026-05-01' }),
        w({ id: 'c', jobId: 'jA', observedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerWeatherMonthly({ jobs: [], weatherLogs: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalEntries).toBe(0);
  });
});
