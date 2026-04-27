import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Dispatch } from './dispatch';
import type { Job } from './job';
import type { Vendor } from './vendor';

import { buildJobEquipmentCost } from './job-equipment-cost';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'job-1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function vendor(over: Partial<Vendor>): Vendor {
  return {
    id: 'vnd-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    legalName: 'Acme Rentals LLC',
    kind: 'EQUIPMENT_RENTAL',
    w9OnFile: false,
    is1099Reportable: false,
    coiOnFile: false,
    paymentTerms: 'NET_30',
    onHold: false,
    ...over,
  } as Vendor;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme Rentals LLC',
    invoiceDate: '2026-04-01',
    jobId: 'job-1',
    lineItems: [],
    totalCents: 5_000_00,
    paidCents: 0,
    status: 'APPROVED',
    ...over,
  } as ApInvoice;
}

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    scheduledFor: '2026-04-01',
    foremanName: 'Lopez',
    scopeOfWork: 'Grade base',
    status: 'POSTED',
    crew: [],
    equipment: [],
    ...over,
  } as Dispatch;
}

describe('buildJobEquipmentCost', () => {
  it('rolls up external rental cost from EQUIPMENT_RENTAL vendor', () => {
    const r = buildJobEquipmentCost({
      jobs: [job({})],
      vendors: [vendor({ kind: 'EQUIPMENT_RENTAL' })],
      apInvoices: [ap({ totalCents: 10_000_00 })],
      dispatches: [],
    });
    expect(r.rows[0]?.externalRentalCents).toBe(10_000_00);
  });

  it('rolls up TRUCKING vendor AP as external equipment cost', () => {
    const r = buildJobEquipmentCost({
      jobs: [job({})],
      vendors: [vendor({ kind: 'TRUCKING' })],
      apInvoices: [ap({ totalCents: 5_000_00 })],
      dispatches: [],
    });
    expect(r.rows[0]?.externalRentalCents).toBe(5_000_00);
  });

  it('ignores SUPPLIER and SUBCONTRACTOR vendors', () => {
    const r = buildJobEquipmentCost({
      jobs: [job({})],
      vendors: [vendor({ kind: 'SUPPLIER' })],
      apInvoices: [ap({ totalCents: 99_000_00 })],
      dispatches: [],
    });
    expect(r.rows[0]?.externalRentalCents).toBe(0);
  });

  it('counts internal dispatch days per equipment unit', () => {
    const r = buildJobEquipmentCost({
      jobs: [job({})],
      vendors: [],
      apInvoices: [],
      dispatches: [
        disp({
          id: 'd-1',
          scheduledFor: '2026-04-01',
          equipment: [
            { equipmentId: 'eq-1', name: 'Cat D6T' },
            { equipmentId: 'eq-2', name: 'Roller' },
          ],
        }),
        disp({
          id: 'd-2',
          scheduledFor: '2026-04-02',
          equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T' }],
        }),
      ],
    });
    expect(r.rows[0]?.internalDispatchDays).toBe(3);
  });

  it('multiplies dispatch days by dailyRateCentsPerUnit', () => {
    const r = buildJobEquipmentCost({
      dailyRateCentsPerUnit: 1_000_00,
      jobs: [job({})],
      vendors: [],
      apInvoices: [],
      dispatches: [
        disp({
          equipment: [
            { equipmentId: 'eq-1', name: 'Cat D6T' },
            { equipmentId: 'eq-2', name: 'Roller' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.internalEquipmentCents).toBe(2_000_00);
  });

  it('only counts POSTED + COMPLETED dispatches', () => {
    const r = buildJobEquipmentCost({
      jobs: [job({})],
      vendors: [],
      apInvoices: [],
      dispatches: [
        disp({
          status: 'DRAFT',
          equipment: [{ equipmentId: 'eq-1', name: 'X' }],
        }),
        disp({
          status: 'CANCELLED',
          equipment: [{ equipmentId: 'eq-1', name: 'X' }],
        }),
      ],
    });
    expect(r.rows[0]?.internalDispatchDays).toBe(0);
  });

  it('dedupes the same unit listed twice on one dispatch', () => {
    const r = buildJobEquipmentCost({
      jobs: [job({})],
      vendors: [],
      apInvoices: [],
      dispatches: [
        disp({
          equipment: [
            { equipmentId: 'eq-1', name: 'Cat D6T' },
            { equipmentId: 'eq-1', name: 'Cat D6T' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.internalDispatchDays).toBe(1);
  });

  it('respects window bounds', () => {
    const r = buildJobEquipmentCost({
      fromDate: '2026-04-15',
      toDate: '2026-04-30',
      jobs: [job({})],
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'old', invoiceDate: '2026-03-15' }),
      ],
      dispatches: [
        disp({ id: 'd-old', scheduledFor: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.externalRentalCents).toBe(0);
    expect(r.rows[0]?.internalDispatchDays).toBe(0);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobEquipmentCost({
      jobs: [
        job({ id: 'j-prosp', status: 'PROSPECT' }),
        job({ id: 'j-awd' }),
      ],
      vendors: [],
      apInvoices: [],
      dispatches: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('j-awd');
  });

  it('rolls up totals + sorts by total equipment cost desc', () => {
    const r = buildJobEquipmentCost({
      dailyRateCentsPerUnit: 500_00,
      jobs: [job({ id: 'j-small' }), job({ id: 'j-big' })],
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'a-s', jobId: 'j-small', totalCents: 1_000_00 }),
        ap({ id: 'a-b', jobId: 'j-big', totalCents: 50_000_00 }),
      ],
      dispatches: [],
    });
    expect(r.rows[0]?.jobId).toBe('j-big');
    expect(r.rollup.totalExternalCents).toBe(51_000_00);
  });
});
