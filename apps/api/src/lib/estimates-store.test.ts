import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  createFromDraft,
  getEstimate,
  listEstimates,
  setLineUnitPrice,
  updateEstimate,
} from './estimates-store';
import type { PtoEOutput } from '@yge/shared';

let tmpDir: string;
const ORIGINAL_ENV = process.env.ESTIMATES_DATA_DIR;

const sampleDraft: PtoEOutput = {
  projectName: 'Sample Drainage Job',
  projectType: 'DRAINAGE',
  bidItems: [
    {
      itemNumber: '1',
      description: 'Class 2 aggregate base',
      unit: 'TON',
      quantity: 100,
      confidence: 'HIGH',
    },
    {
      itemNumber: '2',
      description: 'Hot mix asphalt',
      unit: 'TON',
      quantity: 50,
      confidence: 'MEDIUM',
    },
  ],
  assumptions: [],
  questionsForEstimator: [],
  overallConfidence: 'HIGH',
};

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yge-estimates-'));
  process.env.ESTIMATES_DATA_DIR = tmpDir;
});

afterEach(async () => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.ESTIMATES_DATA_DIR;
  } else {
    process.env.ESTIMATES_DATA_DIR = ORIGINAL_ENV;
  }
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('createFromDraft', () => {
  it('creates an estimate with all bid items unpriced', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });

    expect(est.id).toMatch(/^est-\d{4}-\d{2}-\d{2}-sample-drainage-job-[a-f0-9]{8}$/);
    expect(est.bidItems).toHaveLength(2);
    expect(est.bidItems.every((i) => i.unitPriceCents === null)).toBe(true);
    expect(est.oppPercent).toBe(0.2); // default
  });

  it('honors caller-provided oppPercent', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
      oppPercent: 0.35,
    });
    expect(est.oppPercent).toBe(0.35);
  });

  it('writes a file we can re-read by id', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });
    const fetched = await getEstimate(est.id);
    expect(fetched?.id).toBe(est.id);
    expect(fetched?.bidItems).toHaveLength(2);
  });

  it('appends a summary to the index, newest first', async () => {
    await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: { ...sampleDraft, projectName: 'First' },
    });
    await new Promise((r) => setTimeout(r, 5));
    await createFromDraft({
      fromDraftId: 'd2',
      jobId: 'cltest000000000000000000',
      draft: { ...sampleDraft, projectName: 'Second' },
    });
    const list = await listEstimates();
    expect(list).toHaveLength(2);
    expect(list[0].projectName).toBe('Second');
    expect(list[1].projectName).toBe('First');
  });
});

describe('getEstimate', () => {
  it('returns null on unknown id', async () => {
    const e = await getEstimate('est-2026-01-01-nope-deadbeef');
    expect(e).toBeNull();
  });

  it('rejects path-traversal attempts', async () => {
    expect(await getEstimate('../etc/passwd')).toBeNull();
    expect(await getEstimate('est-../foo')).toBeNull();
  });
});

describe('updateEstimate', () => {
  it('updates oppPercent and bumps updatedAt', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });
    const originalUpdated = est.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateEstimate(est.id, { oppPercent: 0.25 });
    expect(updated?.oppPercent).toBe(0.25);
    expect(updated?.updatedAt).not.toBe(originalUpdated);
  });

  it('updates totals in the index', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });
    // Price both lines: 100 * $50 + 50 * $80 = $5000 + $4000 = $9000.
    // 20% O&P → $10800 total = 1_080_000 cents.
    const items = est.bidItems.map((it, i) =>
      i === 0 ? { ...it, unitPriceCents: 50_00 } : { ...it, unitPriceCents: 80_00 },
    );
    await updateEstimate(est.id, { bidItems: items });
    const list = await listEstimates();
    expect(list[0].bidTotalCents).toBe(10_800_00);
    expect(list[0].pricedLineCount).toBe(2);
    expect(list[0].unpricedLineCount).toBe(0);
  });

  it('returns null on unknown id', async () => {
    const out = await updateEstimate('est-2026-01-01-nope-deadbeef', { oppPercent: 0.3 });
    expect(out).toBeNull();
  });
});

describe('setLineUnitPrice', () => {
  it('updates a single line', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });
    const updated = await setLineUnitPrice(est.id, 1, 99_99);
    expect(updated?.bidItems[0].unitPriceCents).toBeNull();
    expect(updated?.bidItems[1].unitPriceCents).toBe(99_99);
  });

  it('rejects out-of-range index', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });
    expect(await setLineUnitPrice(est.id, 99, 100)).toBeNull();
    expect(await setLineUnitPrice(est.id, -1, 100)).toBeNull();
  });

  it('returns null on unknown id', async () => {
    expect(
      await setLineUnitPrice('est-2026-01-01-nope-deadbeef', 0, 100),
    ).toBeNull();
  });
});

describe('subBids', () => {
  it('starts empty on a fresh estimate', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });
    expect(est.subBids).toEqual([]);
  });

  it('round-trips a sub list through updateEstimate', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });
    const updated = await updateEstimate(est.id, {
      subBids: [
        {
          id: 'sub-aaaaaaaa',
          contractorName: 'Acme Trucking, Inc.',
          address: '123 Anywhere St, Anytown CA',
          cslbLicense: '999999',
          dirRegistration: '1000111222',
          portionOfWork: 'Off-haul of unsuitable material',
          bidAmountCents: 25_000_00,
        },
      ],
    });
    expect(updated?.subBids).toHaveLength(1);
    expect(updated?.subBids[0].contractorName).toBe('Acme Trucking, Inc.');

    const fetched = await getEstimate(est.id);
    expect(fetched?.subBids).toHaveLength(1);
    expect(fetched?.subBids[0].bidAmountCents).toBe(25_000_00);
  });

  it('round-trips bidSecurity through updateEstimate', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });
    const updated = await updateEstimate(est.id, {
      bidSecurity: {
        type: 'BID_BOND',
        percent: 0.1,
        suretyName: 'Travelers Casualty and Surety Co.',
        bondNumber: '107XYZ12345',
      },
    });
    expect(updated?.bidSecurity?.type).toBe('BID_BOND');
    expect(updated?.bidSecurity?.percent).toBe(0.1);

    const fetched = await getEstimate(est.id);
    expect(fetched?.bidSecurity?.bondNumber).toBe('107XYZ12345');
  });

  it('clears bidSecurity when patched with null', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });
    await updateEstimate(est.id, {
      bidSecurity: { type: 'BID_BOND', percent: 0.1 },
    });
    const cleared = await updateEstimate(est.id, { bidSecurity: null });
    expect(cleared?.bidSecurity).toBeUndefined();
  });

  it('replaces the whole sub list when patched', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });
    await updateEstimate(est.id, {
      subBids: [
        {
          id: 'sub-1',
          contractorName: 'First',
          portionOfWork: 'A',
          bidAmountCents: 1_000_00,
        },
        {
          id: 'sub-2',
          contractorName: 'Second',
          portionOfWork: 'B',
          bidAmountCents: 2_000_00,
        },
      ],
    });
    // Replace with a single new entry — old two should be gone.
    const after = await updateEstimate(est.id, {
      subBids: [
        {
          id: 'sub-3',
          contractorName: 'Third',
          portionOfWork: 'C',
          bidAmountCents: 3_000_00,
        },
      ],
    });
    expect(after?.subBids).toHaveLength(1);
    expect(after?.subBids[0].id).toBe('sub-3');
  });
});

describe('addenda', () => {
  it('starts empty on a fresh estimate', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });
    expect(est.addenda).toEqual([]);
  });

  it('round-trips an addendum list through updateEstimate', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });
    const updated = await updateEstimate(est.id, {
      addenda: [
        {
          id: 'add-1',
          number: '1',
          dateIssued: '2026-04-15',
          subject: 'Schedule extension to 4/30',
          acknowledged: true,
        },
        {
          id: 'add-2',
          number: '2',
          dateIssued: '2026-04-20',
          subject: 'Drawing C-3 revision',
          acknowledged: false,
        },
      ],
    });
    expect(updated?.addenda).toHaveLength(2);

    const fetched = await getEstimate(est.id);
    expect(fetched?.addenda).toHaveLength(2);
    expect(fetched?.addenda[1].acknowledged).toBe(false);
  });

  it('summary tracks addendum + un-acked counts', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });
    await updateEstimate(est.id, {
      addenda: [
        { id: 'add-1', number: '1', acknowledged: true },
        { id: 'add-2', number: '2', acknowledged: false },
        { id: 'add-3', number: '3', acknowledged: false },
      ],
    });
    const list = await listEstimates();
    expect(list[0].addendumCount).toBe(3);
    expect(list[0].unacknowledgedAddendumCount).toBe(2);
  });

  it('replaces the whole addendum list when patched', async () => {
    const est = await createFromDraft({
      fromDraftId: 'd1',
      jobId: 'cltest000000000000000000',
      draft: sampleDraft,
    });
    await updateEstimate(est.id, {
      addenda: [
        { id: 'add-1', number: '1', acknowledged: true },
        { id: 'add-2', number: '2', acknowledged: false },
      ],
    });
    // Replace with a single new entry — old two should be gone.
    const after = await updateEstimate(est.id, {
      addenda: [{ id: 'add-3', number: '3', acknowledged: true }],
    });
    expect(after?.addenda).toHaveLength(1);
    expect(after?.addenda[0].number).toBe('3');
  });
});
