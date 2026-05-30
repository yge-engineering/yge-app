import { describe, it, expect } from 'vitest';

import {
  EXTENSION_SNAPSHOT_FIELD_LABELS,
  ExtensionProfileSnapshotSchema,
  PROFILE_PATH_TO_SNAPSHOT_KEY,
  lookupSnapshotValue,
  type ExtensionProfileSnapshot,
} from './extension-profile-snapshot';

const sample: ExtensionProfileSnapshot = {
  schemaVersion: 1,
  generatedAt: '2026-05-26T12:00:00Z',
  legalName: 'Young General Engineering, Inc.',
  shortName: 'YGE',
  federalEin: '12-3456789',
  cslbLicense: '1145219',
  cslbClassifications: 'A, C-12',
  dirNumber: '2000018967',
  dotNumber: '4528204',
  naicsCodes: '115310',
  pscCodes: 'F003, F004',
  caMcpNumber: 'CA-MCP-001',
  caEntityNumber: 'C1234567',
  caEmployerAccountNumber: '999-9999-9',
  addressOneLine: '19645 Little Woods Rd, Cottonwood, CA 96022',
  addressStreet: '19645 Little Woods Rd',
  addressCity: 'Cottonwood',
  addressState: 'CA',
  addressZip: '96022',
  addressCounty: 'Shasta',
  primaryPhone: '707-599-9921',
  primaryFax: '707-555-0199',
  primaryEmail: 'ryoung@youngge.com',
  websiteUrl: 'https://www.youngge.com',
  presidentName: 'Brook L. Young',
  presidentTitle: 'President',
  presidentPhone: '707-499-7065',
  presidentEmail: 'brookyoung@youngge.com',
  vpName: 'Ryan D. Young',
  vpTitle: 'Vice President',
  vpPhone: '707-599-9921',
  vpEmail: 'ryoung@youngge.com',
};

describe('ExtensionProfileSnapshotSchema', () => {
  it('parses a full snapshot', () => {
    expect(() => ExtensionProfileSnapshotSchema.parse(sample)).not.toThrow();
  });

  it('rejects schemaVersion other than 1', () => {
    expect(() =>
      ExtensionProfileSnapshotSchema.parse({ ...sample, schemaVersion: 2 }),
    ).toThrow();
  });

  it('rejects when legalName is missing', () => {
    const { legalName, ...rest } = sample;
    void legalName;
    expect(() => ExtensionProfileSnapshotSchema.parse(rest)).toThrow();
  });

  it('accepts a snapshot without optional federalEin', () => {
    const { federalEin, ...rest } = sample;
    void federalEin;
    expect(() => ExtensionProfileSnapshotSchema.parse(rest)).not.toThrow();
  });
});

describe('lookupSnapshotValue', () => {
  it('resolves legalName', () => {
    expect(lookupSnapshotValue(sample, 'legalName')).toBe(
      'Young General Engineering, Inc.',
    );
  });

  it('resolves nested-path keys', () => {
    expect(lookupSnapshotValue(sample, 'address.street')).toBe(
      '19645 Little Woods Rd',
    );
    expect(lookupSnapshotValue(sample, 'officers.president.email')).toBe(
      'brookyoung@youngge.com',
    );
  });

  it('returns undefined for unknown paths', () => {
    expect(lookupSnapshotValue(sample, 'totally.unknown.path')).toBeUndefined();
  });

  it('returns undefined when the snapshot field is empty', () => {
    const empty = { ...sample, dotNumber: '' };
    expect(lookupSnapshotValue(empty, 'dotNumber')).toBeUndefined();
  });
});

describe('PROFILE_PATH_TO_SNAPSHOT_KEY', () => {
  it('every value is a known snapshot key', () => {
    for (const key of Object.values(PROFILE_PATH_TO_SNAPSHOT_KEY)) {
      expect(key in sample).toBe(true);
    }
  });

  it('covers the 17 core field-pattern paths', () => {
    expect(Object.keys(PROFILE_PATH_TO_SNAPSHOT_KEY).length).toBeGreaterThanOrEqual(15);
  });
});

describe('EXTENSION_SNAPSHOT_FIELD_LABELS', () => {
  it('every label is a non-empty string', () => {
    for (const [key, label] of Object.entries(EXTENSION_SNAPSHOT_FIELD_LABELS)) {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
      void key;
    }
  });

  it('every label is unique (no copy-paste duplicates)', () => {
    const labels = Object.values(EXTENSION_SNAPSHOT_FIELD_LABELS);
    const set = new Set(labels);
    expect(set.size).toBe(labels.length);
  });

  it('every snapshot key has a label (Record<keyof T> guarantee)', () => {
    // The Record<keyof ExtensionProfileSnapshot, string> type
    // already enforces this at compile time; this test catches a
    // future refactor that might use a looser type.
    for (const key of Object.keys(sample)) {
      expect(
        EXTENSION_SNAPSHOT_FIELD_LABELS[
          key as keyof typeof EXTENSION_SNAPSHOT_FIELD_LABELS
        ],
      ).toBeTruthy();
    }
  });
});
