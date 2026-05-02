import { describe, expect, it } from 'vitest';
import {
  buildFillReport,
  computeFieldValue,
  computeFillValues,
  COMPUTED_SOURCES,
  type FillContext,
} from './pdf-form-filler';
import { MasterProfileSchema, type MasterProfile } from './master-profile';
import {
  PdfFormMappingSchema,
  type PdfFormFieldMapping,
  type PdfFormMapping,
} from './pdf-form-mapping';

function profile(over: Partial<MasterProfile> = {}): MasterProfile {
  return MasterProfileSchema.parse({
    id: 'master',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    legalName: 'Young General Engineering, Inc.',
    shortName: 'YGE',
    cslbLicense: '1145219',
    dirNumber: '2000018967',
    dotNumber: '4528204',
    naicsCodes: ['115310'],
    pscCodes: ['F003', 'F004'],
    address: {
      street: '19645 Little Woods Rd',
      city: 'Cottonwood',
      state: 'CA',
      zip: '96022',
    },
    primaryPhone: '707-499-7065',
    primaryEmail: 'info@youngge.com',
    officers: [
      { id: 'officer-1', name: 'Brook L. Young', title: 'President', roleKey: 'president', phone: '707-499-7065', email: 'brookyoung@youngge.com' },
      { id: 'officer-2', name: 'Ryan D. Young', title: 'Vice President', roleKey: 'vp', phone: '707-599-9921', email: 'ryoung@youngge.com' },
    ],
    ...over,
  });
}

function field(over: Partial<PdfFormFieldMapping>): PdfFormFieldMapping {
  return {
    id: 'pdf-fld-1',
    pdfFieldName: 'name',
    label: 'Name',
    kind: 'TEXT',
    source: { kind: 'profile-path', path: 'legalName' },
    required: false,
    ...over,
  } as PdfFormFieldMapping;
}

function form(over: Partial<PdfFormMapping> = {}): PdfFormMapping {
  return PdfFormMappingSchema.parse({
    id: 'pdf-form-1',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    displayName: 'Test',
    agency: 'CAL_FIRE',
    pdfReference: 'x.pdf',
    fields: [field({})],
    ...over,
  });
}

const NOW = new Date('2026-04-15T12:00:00Z');
const ctx = (over: Partial<FillContext> = {}): FillContext => ({
  profile: profile(),
  now: NOW,
  ...over,
});

describe('computeFieldValue — profile-path', () => {
  it('reads a top-level field', () => {
    const r = computeFieldValue(field({ source: { kind: 'profile-path', path: 'cslbLicense' } }), ctx());
    expect(r.value).toBe('1145219');
    expect(r.filled).toBe(true);
  });

  it('reads a nested address field', () => {
    const r = computeFieldValue(field({ source: { kind: 'profile-path', path: 'address.city' } }), ctx());
    expect(r.value).toBe('Cottonwood');
  });

  it('reads via roleKey shortcut', () => {
    const r = computeFieldValue(
      field({ source: { kind: 'profile-path', path: 'officers.president.email' } }),
      ctx(),
    );
    expect(r.value).toBe('brookyoung@youngge.com');
  });

  it('uses fallback when path resolves to undefined', () => {
    const r = computeFieldValue(
      field({ source: { kind: 'profile-path', path: 'caEntityNumber', fallback: 'TBD' } }),
      ctx(),
    );
    expect(r.value).toBe('TBD');
    expect(r.filled).toBe(true);
  });

  it('returns unfilled empty string when no fallback + no value', () => {
    const r = computeFieldValue(
      field({ source: { kind: 'profile-path', path: 'caEntityNumber' } }),
      ctx(),
    );
    expect(r.value).toBe('');
    expect(r.filled).toBe(false);
  });

  it('joins array values with commas', () => {
    const r = computeFieldValue(
      field({ source: { kind: 'profile-path', path: 'pscCodes' } }),
      ctx(),
    );
    expect(r.value).toBe('F003, F004');
  });
});

describe('computeFieldValue — literal', () => {
  it('returns the literal string', () => {
    const r = computeFieldValue(field({ source: { kind: 'literal', value: 'YGE' } }), ctx());
    expect(r.value).toBe('YGE');
    expect(r.filled).toBe(true);
  });

  it('treats empty literal as unfilled', () => {
    const r = computeFieldValue(field({ source: { kind: 'literal', value: '' } }), ctx());
    expect(r.filled).toBe(false);
  });
});

describe('computeFieldValue — computed', () => {
  it('renders date.today as yyyy-mm-dd', () => {
    const r = computeFieldValue(field({ source: { kind: 'computed', name: 'date.today' } }), ctx());
    expect(r.value).toBe('2026-04-15');
  });

  it('renders date.today.us as mm/dd/yyyy', () => {
    const r = computeFieldValue(field({ source: { kind: 'computed', name: 'date.today.us' } }), ctx());
    expect(r.value).toBe('04/15/2026');
  });

  it('renders profile.address.oneLine', () => {
    const r = computeFieldValue(field({ source: { kind: 'computed', name: 'profile.address.oneLine' } }), ctx());
    expect(r.value).toBe('19645 Little Woods Rd, Cottonwood, CA 96022');
  });

  it('renders president signature block', () => {
    const r = computeFieldValue(
      field({ source: { kind: 'computed', name: 'profile.officers.president.signature' } }),
      ctx(),
    );
    expect(r.value).toBe('Brook L. Young, President');
  });

  it('renders bid validity expiry from default 60 days', () => {
    const r = computeFieldValue(
      field({ source: { kind: 'computed', name: 'profile.bidValidity.expiresOn' } }),
      ctx(),
    );
    expect(r.value).toBe('2026-06-14');
  });

  it('respects bidValidityDays override', () => {
    const r = computeFieldValue(
      field({ source: { kind: 'computed', name: 'profile.bidValidity.expiresOn' } }),
      ctx({ bidValidityDays: 90 }),
    );
    expect(r.value).toBe('2026-07-14');
  });

  it('returns empty for unknown computed name', () => {
    const r = computeFieldValue(field({ source: { kind: 'computed', name: 'nope.unknown' } }), ctx());
    expect(r.value).toBe('');
    expect(r.filled).toBe(false);
  });
});

describe('computeFieldValue — prompt', () => {
  it('reports awaitingPrompt when no answer supplied', () => {
    const r = computeFieldValue(
      field({ id: 'pdf-fld-x', source: { kind: 'prompt', label: 'Project number', sensitive: false } }),
      ctx(),
    );
    expect(r.awaitingPrompt).toBe(true);
    expect(r.filled).toBe(false);
  });

  it('uses the operator answer when supplied', () => {
    const r = computeFieldValue(
      field({ id: 'pdf-fld-x', source: { kind: 'prompt', label: 'Project number', sensitive: false } }),
      ctx({ promptAnswers: { 'pdf-fld-x': 'CT-2026-101' } }),
    );
    expect(r.awaitingPrompt).toBe(false);
    expect(r.value).toBe('CT-2026-101');
  });
});

describe('buildFillReport', () => {
  it('flags required-but-empty fields', () => {
    const m = form({
      fields: [
        field({ id: 'pdf-fld-1', required: true, source: { kind: 'profile-path', path: 'caEntityNumber' } }),
        field({ id: 'pdf-fld-2', required: false, source: { kind: 'profile-path', path: 'cslbLicense' } }),
      ],
    });
    const r = buildFillReport(m, ctx());
    expect(r.total).toBe(2);
    expect(r.requiredEmpty.map((v) => v.fieldId)).toEqual(['pdf-fld-1']);
    expect(r.filledCount).toBe(1);
  });

  it('flags pattern violations', () => {
    const m = form({
      fields: [
        field({
          id: 'pdf-fld-1',
          pattern: '^\\d{7}$',
          source: { kind: 'literal', value: 'NOT-7-DIGITS' },
        }),
      ],
    });
    const r = buildFillReport(m, ctx());
    expect(r.patternViolations).toHaveLength(1);
    expect(r.patternViolations[0]!.field.fieldId).toBe('pdf-fld-1');
  });

  it('counts awaitingPromptCount + sensitive separately', () => {
    const m = form({
      fields: [
        field({ id: 'pdf-fld-1', source: { kind: 'prompt', label: 'Project #', sensitive: false } }),
        field({ id: 'pdf-fld-2', source: { kind: 'prompt', label: 'SSN last 4', sensitive: true } }),
      ],
    });
    const r = buildFillReport(m, ctx());
    expect(r.awaitingPromptCount).toBe(2);
    expect(r.awaitingSensitivePrompts).toHaveLength(1);
    expect(r.awaitingSensitivePrompts[0]!.fieldId).toBe('pdf-fld-2');
  });

  it('handles a fully-filled mapping', () => {
    const m = form({
      fields: [
        field({ id: 'pdf-fld-1', source: { kind: 'profile-path', path: 'cslbLicense' } }),
        field({ id: 'pdf-fld-2', source: { kind: 'literal', value: 'YGE' } }),
      ],
    });
    const r = buildFillReport(m, ctx());
    expect(r.filledCount).toBe(2);
    expect(r.requiredEmpty).toEqual([]);
    expect(r.awaitingPromptCount).toBe(0);
  });
});

describe('computeFillValues', () => {
  it('returns one entry per mapping field in order', () => {
    const m = form({
      fields: [
        field({ id: 'pdf-fld-1', source: { kind: 'literal', value: 'A' } }),
        field({ id: 'pdf-fld-2', source: { kind: 'literal', value: 'B' } }),
        field({ id: 'pdf-fld-3', source: { kind: 'literal', value: 'C' } }),
      ],
    });
    const r = computeFillValues(m, ctx());
    expect(r.map((v) => v.value)).toEqual(['A', 'B', 'C']);
  });
});

describe('COMPUTED_SOURCES registry', () => {
  it('lists every name implemented by computeNamed', () => {
    expect(COMPUTED_SOURCES.has('date.today')).toBe(true);
    expect(COMPUTED_SOURCES.has('date.today.us')).toBe(true);
    expect(COMPUTED_SOURCES.has('profile.address.oneLine')).toBe(true);
    expect(COMPUTED_SOURCES.has('profile.officers.president.signature')).toBe(true);
    expect(COMPUTED_SOURCES.has('profile.officers.vp.signature')).toBe(true);
  });
});
