import { describe, it, expect } from 'vitest';
import {
  SubcontractCoverInputSchema,
  buildSubcontractCover,
  type SubcontractCoverInput,
} from './subcontract-cover';

const baseInput: SubcontractCoverInput = SubcontractCoverInputSchema.parse({
  projectName: 'Sulphur Springs Soquol Rd',
  projectNumber: 'SS-2026',
  ownerAgency: 'Mendocino County',
  subName: 'Acme Concrete Inc.',
  subContactName: 'Sam Smith',
  subAddress: '123 Main St, Ukiah CA 95482',
  scopeDescription:
    'Furnish + install concrete sidewalks per plans + specs. Approx. 1,200 LF, 4-in. thick, broom finish.',
  contractAmountCents: 48_000_00,
  retentionPct: 0.05,
  letterDate: '2026-05-22',
  startDate: '2026-06-15',
  prevailingWage: false,
  ourSignerName: 'Ryan Young',
  ourSignerTitle: 'VP',
});

describe('buildSubcontractCover', () => {
  it('includes the standard YGE clauses every cover letter has', () => {
    const r = buildSubcontractCover(baseInput);
    expect(r.body).toContain('Insurance certificates must arrive');
    expect(r.body).toContain('Conditional lien waiver');
    expect(r.body).toContain('CA Civ. Code §8132');
    expect(r.body).toContain('IIPP');
    expect(r.body).toContain('CA Civ. §2782.05');
  });

  it('formats the subcontract amount as US dollars', () => {
    const r = buildSubcontractCover(baseInput);
    expect(r.body).toContain('$48,000.00');
  });

  it('renders the retention percentage', () => {
    const r = buildSubcontractCover(baseInput);
    expect(r.body).toContain('5% withheld');
  });

  it('includes the project name + agency + number', () => {
    const r = buildSubcontractCover(baseInput);
    expect(r.body).toContain('Sulphur Springs Soquol Rd');
    expect(r.body).toContain('Mendocino County');
    expect(r.body).toContain('SS-2026');
  });

  it('greets by first name', () => {
    const r = buildSubcontractCover(baseInput);
    expect(r.body).toContain('Dear Sam,');
  });

  it('includes start date when supplied', () => {
    const r = buildSubcontractCover(baseInput);
    expect(r.body).toContain('Anticipated start on site: 2026-06-15');
  });

  it('omits start-date line when not supplied', () => {
    const ctx = SubcontractCoverInputSchema.parse({
      ...baseInput,
      startDate: undefined,
    });
    const r = buildSubcontractCover(ctx);
    expect(r.body).not.toContain('Anticipated start on site');
  });

  it('omits project number line when not supplied', () => {
    const ctx = SubcontractCoverInputSchema.parse({
      ...baseInput,
      projectNumber: undefined,
    });
    const r = buildSubcontractCover(ctx);
    expect(r.body).not.toContain('Project number:');
  });

  it('omits agency line when not supplied', () => {
    const ctx = SubcontractCoverInputSchema.parse({
      ...baseInput,
      ownerAgency: undefined,
    });
    const r = buildSubcontractCover(ctx);
    expect(r.body).not.toContain('Owner / awarding agency:');
  });
});

describe('buildSubcontractCover — public works', () => {
  it('adds the PW clause when prevailingWage is true', () => {
    const r = buildSubcontractCover({ ...baseInput, prevailingWage: true });
    expect(r.body).toContain('PUBLIC WORKS — CA Labor Code §1720');
    expect(r.body).toContain('DIR prevailing wage');
    expect(r.body).toContain('CPRs');
    expect(r.body).toContain('DAS-140 / DAS-142');
  });

  it('omits the PW clause by default', () => {
    const r = buildSubcontractCover(baseInput);
    expect(r.body).not.toContain('PUBLIC WORKS');
  });
});

describe('buildSubcontractCover — enclosures', () => {
  it('returns the standard 5-item enclosure list', () => {
    const r = buildSubcontractCover(baseInput);
    expect(r.enclosureList.length).toBeGreaterThanOrEqual(5);
    expect(r.enclosureList.join(' ')).toContain('Certificate of Insurance');
    expect(r.enclosureList.join(' ')).toContain('W-9');
  });

  it('numbers the enclosures inside the letter body', () => {
    const r = buildSubcontractCover(baseInput);
    expect(r.body).toContain('1. Signed subcontract');
  });
});
