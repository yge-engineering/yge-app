import { describe, expect, it } from 'vitest';
import {
  PdfFormMappingSchema,
  computeFillability,
  computeFormLibraryRollup,
  newPdfFormFieldId,
  newPdfFormMappingId,
  summarizeFieldKinds,
  type PdfFormMapping,
} from './pdf-form-mapping';

function field(over: Partial<PdfFormMapping['fields'][number]> = {}): PdfFormMapping['fields'][number] {
  return {
    id: 'pdf-fld-aaaaaaaa',
    pdfFieldName: 'Form[0].Page1[0].ContractorName[0]',
    label: 'Contractor name',
    kind: 'TEXT',
    source: { kind: 'profile-path', path: 'legalName' },
    required: true,
    ...over,
  };
}

function form(over: Partial<PdfFormMapping> = {}): PdfFormMapping {
  return PdfFormMappingSchema.parse({
    id: 'pdf-form-aaaaaaaa',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    displayName: 'CAL FIRE 720 — Bid Form',
    agency: 'CAL_FIRE',
    formCode: 'CALFIRE-720',
    versionDate: '2025-09-01',
    pdfReference: 'pdf-forms/cal-fire/720.pdf',
    fields: [field()],
    ...over,
  });
}

describe('id helpers', () => {
  it('newPdfFormMappingId follows the pattern', () => {
    expect(newPdfFormMappingId()).toMatch(/^pdf-form-[0-9a-f]{8}$/);
  });
  it('newPdfFormFieldId follows the pattern', () => {
    expect(newPdfFormFieldId()).toMatch(/^pdf-fld-[0-9a-f]{8}$/);
  });
});

describe('PdfFormMappingSchema', () => {
  it('rejects an empty fields list', () => {
    expect(() => form({ fields: [] })).toThrow();
  });

  it('rejects an unknown agency', () => {
    expect(() => PdfFormMappingSchema.parse({
      ...form(),
      agency: 'MARTIAN_TRIBAL_COUNCIL',
    })).toThrow();
  });

  it('rejects a profile-path source with an empty path', () => {
    expect(() => form({
      fields: [field({ source: { kind: 'profile-path', path: '' } })],
    })).toThrow();
  });

  it('accepts the four source kinds', () => {
    const f = form({
      fields: [
        field({ id: 'pdf-fld-1', source: { kind: 'profile-path', path: 'legalName' } }),
        field({ id: 'pdf-fld-2', source: { kind: 'literal', value: 'YGE' } }),
        field({ id: 'pdf-fld-3', source: { kind: 'computed', name: 'date.today' } }),
        field({ id: 'pdf-fld-4', source: { kind: 'prompt', label: 'Project number', sensitive: false } }),
      ],
    });
    expect(f.fields).toHaveLength(4);
  });

  it('defaults reviewed=false on a fresh mapping', () => {
    expect(form().reviewed).toBe(false);
  });
});

describe('summarizeFieldKinds', () => {
  it('counts each kind correctly', () => {
    const fields = [
      field({ id: 'pdf-fld-1', kind: 'TEXT' }),
      field({ id: 'pdf-fld-2', kind: 'CHECKBOX' }),
      field({ id: 'pdf-fld-3', kind: 'CHECKBOX' }),
      field({ id: 'pdf-fld-4', kind: 'SIGNATURE' }),
      field({ id: 'pdf-fld-5', kind: 'DATE' }),
    ];
    const r = summarizeFieldKinds(fields);
    expect(r.text).toBe(1);
    expect(r.checkbox).toBe(2);
    expect(r.signature).toBe(1);
    expect(r.date).toBe(1);
  });
});

describe('computeFillability', () => {
  it('splits auto vs prompt vs sensitive prompt', () => {
    const fields = [
      field({ id: 'pdf-fld-1', source: { kind: 'profile-path', path: 'legalName' } }),
      field({ id: 'pdf-fld-2', source: { kind: 'literal', value: 'YGE' } }),
      field({ id: 'pdf-fld-3', source: { kind: 'computed', name: 'date.today' } }),
      field({ id: 'pdf-fld-4', source: { kind: 'prompt', label: 'Project number', sensitive: false } }),
      field({ id: 'pdf-fld-5', source: { kind: 'prompt', label: 'SSN last 4', sensitive: true } }),
    ];
    const r = computeFillability(fields);
    expect(r.total).toBe(5);
    expect(r.autoFillCount).toBe(3);
    expect(r.promptCount).toBe(2);
    expect(r.sensitivePromptCount).toBe(1);
  });
});

describe('computeFormLibraryRollup', () => {
  it('rolls up by agency + reviewed/draft counts', () => {
    const forms = [
      form({ id: 'pdf-form-1', agency: 'CAL_FIRE', reviewed: true }),
      form({ id: 'pdf-form-2', agency: 'CAL_FIRE', reviewed: false }),
      form({ id: 'pdf-form-3', agency: 'IRS', reviewed: true }),
    ];
    const r = computeFormLibraryRollup(forms);
    expect(r.total).toBe(3);
    expect(r.reviewedCount).toBe(2);
    expect(r.draftCount).toBe(1);
    expect(r.byAgency[0]!.agency).toBe('CAL_FIRE');
    expect(r.byAgency[0]!.count).toBe(2);
  });
});
