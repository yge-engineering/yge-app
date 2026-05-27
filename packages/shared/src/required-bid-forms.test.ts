import { describe, it, expect } from 'vitest';

import {
  classifyAgencyType,
  requiredBidFormsFor,
} from './required-bid-forms';

describe('classifyAgencyType', () => {
  it('returns UNKNOWN for empty input', () => {
    expect(classifyAgencyType(undefined)).toBe('UNKNOWN');
    expect(classifyAgencyType('')).toBe('UNKNOWN');
  });

  it('classifies Caltrans as federal-aid', () => {
    expect(classifyAgencyType('Caltrans District 2')).toBe('CALTRANS_FEDERAL_AID');
  });

  it('classifies CAL FIRE variants', () => {
    expect(classifyAgencyType('CAL FIRE')).toBe('CAL_FIRE');
    expect(classifyAgencyType('CalFire')).toBe('CAL_FIRE');
  });

  it('classifies each NorCal county', () => {
    expect(classifyAgencyType('Shasta County')).toBe('COUNTY_SHASTA');
    expect(classifyAgencyType('County of Tehama')).toBe('COUNTY_TEHAMA');
    expect(classifyAgencyType('Glenn County PW')).toBe('COUNTY_GLENN');
    expect(classifyAgencyType('Lassen County')).toBe('COUNTY_LASSEN');
    expect(classifyAgencyType('Siskiyou County')).toBe('COUNTY_SISKIYOU');
    expect(classifyAgencyType('Modoc County')).toBe('COUNTY_MODOC');
    expect(classifyAgencyType('Butte County')).toBe('COUNTY_BUTTE');
  });

  it('falls back to COUNTY_OTHER for unknown counties', () => {
    expect(classifyAgencyType('Yolo County')).toBe('COUNTY_OTHER');
  });

  it('classifies cities', () => {
    expect(classifyAgencyType('City of Redding')).toBe('CITY');
    expect(classifyAgencyType('Town of Cottonwood')).toBe('CITY');
  });

  it('classifies federal direct', () => {
    expect(classifyAgencyType('USDA Forest Service')).toBe('FEDERAL_DIRECT');
    expect(classifyAgencyType('BLM Northern California')).toBe('FEDERAL_DIRECT');
  });
});

describe('requiredBidFormsFor', () => {
  it('Caltrans federal-aid returns base + ACORD + federal + PW', () => {
    const forms = requiredBidFormsFor('CALTRANS_FEDERAL_AID');
    expect(forms.length).toBeGreaterThanOrEqual(8);
    expect(forms.map((f) => f.mappingId)).toContain('pdf-form-fhwa-1273');
    expect(forms.map((f) => f.mappingId)).toContain('pdf-form-dir-das-140');
    expect(forms.map((f) => f.mappingId)).toContain('pdf-form-acord-25');
  });

  it('Shasta County adds the county affidavit', () => {
    const forms = requiredBidFormsFor('COUNTY_SHASTA');
    expect(forms.map((f) => f.mappingId)).toContain(
      'pdf-form-shasta-county-bidder-affidavit',
    );
  });

  it('Tehama County adds its own affidavit (not Shasta\'s)', () => {
    const forms = requiredBidFormsFor('COUNTY_TEHAMA');
    expect(forms.map((f) => f.mappingId)).toContain(
      'pdf-form-tehama-county-bidder-affidavit',
    );
    expect(forms.map((f) => f.mappingId)).not.toContain(
      'pdf-form-shasta-county-bidder-affidavit',
    );
  });

  it('CITY returns base + ACORD without federal-aid', () => {
    const forms = requiredBidFormsFor('CITY');
    expect(forms.map((f) => f.mappingId)).not.toContain('pdf-form-fhwa-1273');
    expect(forms.map((f) => f.mappingId)).toContain('pdf-form-acord-25');
  });

  it('UNKNOWN returns the base + ACORD safe-default set', () => {
    const forms = requiredBidFormsFor('UNKNOWN');
    expect(forms.length).toBeGreaterThan(0);
    expect(forms.map((f) => f.mappingId)).toContain(
      'pdf-form-ca-non-collusion-affidavit',
    );
  });

  it('ICA cert is alwaysRequired:false at low bid total', () => {
    const forms = requiredBidFormsFor('CITY', 500_000_00);
    const ica = forms.find((f) => f.mappingId === 'pdf-form-ca-iran-contracting-act');
    expect(ica?.alwaysRequired).toBe(false);
  });

  it('ICA cert is alwaysRequired:true at bid total > $1M', () => {
    const forms = requiredBidFormsFor('CITY', 2_000_000_00);
    const ica = forms.find((f) => f.mappingId === 'pdf-form-ca-iran-contracting-act');
    expect(ica?.alwaysRequired).toBe(true);
  });
});
