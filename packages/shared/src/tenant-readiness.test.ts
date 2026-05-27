import { describe, it, expect } from 'vitest';

import {
  runTenantReadiness,
  type TenantReadinessInputs,
} from './tenant-readiness';

const baseInputs: TenantReadinessInputs = {
  hasMasterProfile: true,
  hasBondingProfile: true,
  hasInsuranceProfile: true,
  laborRateCount: 50,
  equipmentRateCount: 30,
  materialCount: 25,
  customerCount: 10,
  estimateCount: 5,
  draftCount: 12,
  reviewedPdfFormCount: 15,
  totalPdfFormCount: 15,
};

describe('runTenantReadiness', () => {
  it('overall ready when all checks ready', () => {
    const r = runTenantReadiness(baseInputs);
    expect(r.overallStatus).toBe('ready');
    expect(r.counts.missing).toBe(0);
    expect(r.counts.partial).toBe(0);
  });

  it('overall partial when only partial checks present', () => {
    const r = runTenantReadiness({ ...baseInputs, hasMasterProfile: false });
    expect(r.overallStatus).toBe('partial');
    expect(r.counts.partial).toBeGreaterThan(0);
  });

  it('overall missing when any check is missing', () => {
    const r = runTenantReadiness({ ...baseInputs, hasBondingProfile: false });
    expect(r.overallStatus).toBe('missing');
    expect(r.counts.missing).toBeGreaterThan(0);
  });

  it('rate book ready at threshold', () => {
    const r = runTenantReadiness({ ...baseInputs, laborRateCount: 20 });
    const labor = r.checks.find((c) => c.key === 'rate-labor');
    expect(labor?.status).toBe('ready');
  });

  it('rate book partial just below threshold', () => {
    const r = runTenantReadiness({ ...baseInputs, laborRateCount: 5 });
    const labor = r.checks.find((c) => c.key === 'rate-labor');
    expect(labor?.status).toBe('partial');
  });

  it('rate book missing at zero', () => {
    const r = runTenantReadiness({ ...baseInputs, laborRateCount: 0 });
    const labor = r.checks.find((c) => c.key === 'rate-labor');
    expect(labor?.status).toBe('missing');
  });

  it('customers missing when zero', () => {
    const r = runTenantReadiness({ ...baseInputs, customerCount: 0 });
    const cust = r.checks.find((c) => c.key === 'customers');
    expect(cust?.status).toBe('missing');
  });

  it('estimate-activity ready when any drafts exist', () => {
    const r = runTenantReadiness({
      ...baseInputs,
      estimateCount: 0,
      draftCount: 1,
    });
    const a = r.checks.find((c) => c.key === 'estimate-activity');
    expect(a?.status).toBe('ready');
  });

  it('pdf form review partial when some reviewed', () => {
    const r = runTenantReadiness({
      ...baseInputs,
      reviewedPdfFormCount: 7,
      totalPdfFormCount: 15,
    });
    const p = r.checks.find((c) => c.key === 'pdf-form-review');
    expect(p?.status).toBe('partial');
  });

  it('pdf form review ready when all reviewed', () => {
    const r = runTenantReadiness({
      ...baseInputs,
      reviewedPdfFormCount: 15,
      totalPdfFormCount: 15,
    });
    const p = r.checks.find((c) => c.key === 'pdf-form-review');
    expect(p?.status).toBe('ready');
  });

  it('returns 9 checks regardless of inputs', () => {
    const r = runTenantReadiness(baseInputs);
    expect(r.checks).toHaveLength(9);
  });
});
