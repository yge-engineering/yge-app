import { describe, expect, it } from 'vitest';
import { buildMorningBriefing } from './morning-briefing';
import type { ArInvoice } from './ar-invoice';
import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Employee } from './employee';
import type { Incident } from './incident';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'emp-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'OPERATOR',
    classification: 'OPERATING_ENGINEER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

function dispatch(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    scheduledFor: '2026-04-27',
    foremanName: 'Bob',
    scopeOfWork: 'Set forms.',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

function dailyReport(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-26',
    jobId: 'job-1',
    foremanId: 'emp-bob',
    weather: 'sunny',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

function incident(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '',
    updatedAt: '',
    caseNumber: '2026-001',
    logYear: 2026,
    incidentDate: '2026-04-20',
    classification: 'INJURY',
    outcome: 'OTHER_RECORDABLE',
    daysAway: 0,
    daysRestricted: 0,
    privacyCase: false,
    died: false,
    treatedInER: false,
    hospitalizedOvernight: false,
    calOshaReported: false,
    status: 'OPEN',
    ...over,
  } as Incident;
}

describe('buildMorningBriefing', () => {
  it('counts yesterday submitted reports', () => {
    const r = buildMorningBriefing({
      forDate: '2026-04-27',
      employees: [emp({})],
      dailyReports: [
        dailyReport({ id: 'dr-1', date: '2026-04-26', submitted: true }),
        dailyReport({ id: 'dr-2', date: '2026-04-26', submitted: false }), // not submitted
        dailyReport({ id: 'dr-3', date: '2026-04-25', submitted: true }), // wrong day
      ],
      dispatches: [],
      incidents: [],
      arInvoices: [],
    });
    expect(r.yesterdayDate).toBe('2026-04-26');
    expect(r.yesterdayReportCount).toBe(1);
  });

  it('flags jobs dispatched yesterday with no daily report', () => {
    const r = buildMorningBriefing({
      forDate: '2026-04-27',
      employees: [emp({})],
      dailyReports: [
        dailyReport({ jobId: 'job-A', date: '2026-04-26', submitted: true }),
      ],
      dispatches: [
        dispatch({ jobId: 'job-A', scheduledFor: '2026-04-26', status: 'POSTED' }),
        dispatch({ id: 'disp-2', jobId: 'job-B', scheduledFor: '2026-04-26', status: 'POSTED' }),
        dispatch({ id: 'disp-3', jobId: 'job-C', scheduledFor: '2026-04-26', status: 'CANCELLED' }),
      ],
      incidents: [],
      arInvoices: [],
    });
    expect(r.yesterdayMissingReports).toEqual(['job-B']);
    expect(r.headlines[0]).toContain('owe yesterday');
  });

  it("lists today's dispatches with crew + equipment counts", () => {
    const r = buildMorningBriefing({
      forDate: '2026-04-27',
      employees: [emp({})],
      dailyReports: [],
      dispatches: [
        dispatch({
          id: 'd1',
          jobId: 'job-A',
          scheduledFor: '2026-04-27',
          crew: [{ employeeId: 'emp-1', employeeName: 'Bob', role: 'FOREMAN' } as never],
          equipment: [{ name: 'CAT 320E' } as never, { name: 'Service Truck' } as never],
        }),
        dispatch({ id: 'd2', jobId: 'job-B', scheduledFor: '2026-04-26' }), // wrong day
        dispatch({ id: 'd3', jobId: 'job-C', scheduledFor: '2026-04-27', status: 'CANCELLED' }),
      ],
      incidents: [],
      arInvoices: [],
    });
    expect(r.todayDispatches).toHaveLength(1);
    expect(r.todayDispatches[0]?.jobId).toBe('job-A');
    expect(r.todayDispatches[0]?.crewCount).toBe(1);
    expect(r.todayDispatches[0]?.equipmentCount).toBe(2);
  });

  it('flags open serious-injury incidents in headlines', () => {
    const r = buildMorningBriefing({
      forDate: '2026-04-27',
      employees: [emp({})],
      dailyReports: [],
      dispatches: [],
      incidents: [
        incident({ outcome: 'OTHER_RECORDABLE', status: 'OPEN' }),
        incident({ id: 'inc-2', outcome: 'DAYS_AWAY', status: 'OPEN' }),
        incident({ id: 'inc-3', outcome: 'DEATH', status: 'CLOSED' }), // closed; skip
      ],
      arInvoices: [],
    });
    expect(r.openIncidents).toHaveLength(2);
    const hd = r.headlines.find((h) => h.includes('serious-injury'));
    expect(hd).toBeDefined();
  });

  it('rolls 60+ AR into a headline with compact dollar total', () => {
    const old: ArInvoice = {
      id: 'ar-1',
      createdAt: '',
      updatedAt: '',
      jobId: 'job-1',
      invoiceNumber: 'A-1',
      customerName: 'Cal Fire',
      invoiceDate: '2026-01-01',
      dueDate: '2026-01-31',
      source: 'MANUAL',
      lineItems: [],
      subtotalCents: 25_000_00,
      totalCents: 25_000_00,
      paidCents: 0,
      status: 'SENT',
    } as ArInvoice;
    const r = buildMorningBriefing({
      forDate: '2026-04-27',
      employees: [emp({})],
      dailyReports: [],
      dispatches: [],
      incidents: [],
      arInvoices: [old],
    });
    expect(r.oldestArInvoices).toHaveLength(1);
    expect(r.oldestArInvoices[0]?.daysOverdue).toBeGreaterThanOrEqual(60);
    const hd = r.headlines.find((h) => h.includes('60+ days'));
    expect(hd).toBeDefined();
  });

  it('produces no missing-report headline when nothing is missing', () => {
    const r = buildMorningBriefing({
      forDate: '2026-04-27',
      employees: [emp({})],
      dailyReports: [],
      dispatches: [],
      incidents: [],
      arInvoices: [],
    });
    expect(r.headlines.some((h) => h.includes('owe yesterday'))).toBe(false);
  });
});
