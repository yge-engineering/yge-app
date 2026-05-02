// Pre-mapped agency form library — seed data.
//
// Phase-1 starter set: IRS W-9, DIR DAS-140 (apprentice journeyman
// hours notification), ACORD 25 (Certificate of Liability Insurance).
// More forms (CAL FIRE 720, DAS-142, PWC-100, county packets) layer
// in subsequent commits.
//
// All seed mappings start with reviewed=false. An estimator flips
// the flag after sanity-checking the mapping against the agency's
// PDF; the form filler refuses to auto-fill un-reviewed mappings.
//
// pdfFieldName values are placeholder. Real PDFs need their AcroForm
// field names extracted — typically via pdftk dump_data_fields or
// pdf-lib getFields() against the actual byte stream. The byte-
// rewriting bundle that ships next can backfill the real names per
// form.

import type {
  PdfFormFieldMapping,
  PdfFormMapping,
} from '@yge/shared';

interface SeedMapping {
  /** Stable id used as the primary key on first seed. */
  id: string;
  displayName: string;
  agency: PdfFormMapping['agency'];
  formCode?: string;
  versionDate?: string;
  pdfReference: string;
  agencyUrl?: string;
  notes?: string;
  fields: Array<Omit<PdfFormFieldMapping, 'id'> & { id?: string }>;
}

function f(over: Partial<PdfFormFieldMapping>): PdfFormFieldMapping {
  return {
    id: over.id ?? '',
    pdfFieldName: over.pdfFieldName ?? '',
    label: over.label ?? '',
    kind: over.kind ?? 'TEXT',
    source: over.source ?? { kind: 'literal', value: '' },
    required: over.required ?? false,
    truthyValue: over.truthyValue,
    pattern: over.pattern,
  } as PdfFormFieldMapping;
}

// ---- IRS W-9 (Rev. October 2018) ---------------------------------------

const IRS_W9: SeedMapping = {
  id: 'pdf-form-irs-w9',
  displayName: 'IRS W-9 — Request for Taxpayer Identification Number',
  agency: 'IRS',
  formCode: 'W-9',
  versionDate: '2018-10-01',
  pdfReference: 'pdf-forms/irs/fw9.pdf',
  agencyUrl: 'https://www.irs.gov/pub/irs-pdf/fw9.pdf',
  notes: 'YGE files this on every new vendor / customer relationship. Federal EIN goes in Part I.',
  fields: [
    f({ id: 'pdf-fld-w9-name', pdfFieldName: 'topmostSubform[0].Page1[0].f1_1[0]', label: 'Name (as shown on tax return)', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-w9-business', pdfFieldName: 'topmostSubform[0].Page1[0].f1_2[0]', label: 'Business name / DBA', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'shortName' } }),
    f({ id: 'pdf-fld-w9-classification', pdfFieldName: 'topmostSubform[0].Page1[0].c1_1[0]', label: 'Federal tax classification — C corporation', kind: 'CHECKBOX',
        truthyValue: 'X',
        source: { kind: 'literal', value: 'true' } }),
    f({ id: 'pdf-fld-w9-address', pdfFieldName: 'topmostSubform[0].Page1[0].f1_7[0]', label: 'Address (street + suite)', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'address.street' } }),
    f({ id: 'pdf-fld-w9-citystatezip', pdfFieldName: 'topmostSubform[0].Page1[0].f1_8[0]', label: 'City, state, ZIP', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-w9-ein', pdfFieldName: 'topmostSubform[0].Page1[0].EIN[0]', label: 'Employer identification number', kind: 'TEXT', required: true,
        pattern: '^\\d{2}-\\d{7}$',
        source: { kind: 'profile-path', path: 'federalEin' } }),
    f({ id: 'pdf-fld-w9-signature', pdfFieldName: 'topmostSubform[0].Page1[0].f1_30[0]', label: 'Signature of U.S. person', kind: 'SIGNATURE', required: true,
        source: { kind: 'computed', name: 'profile.officers.president.signature' } }),
    f({ id: 'pdf-fld-w9-date', pdfFieldName: 'topmostSubform[0].Page1[0].f1_31[0]', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- DIR DAS-140 (apprentice journeyman hours notification) ------------

const DIR_DAS_140: SeedMapping = {
  id: 'pdf-form-dir-das-140',
  displayName: 'DAS-140 — Public Works Contract Award Information',
  agency: 'CA_DIR',
  formCode: 'DAS-140',
  versionDate: '2023-04-01',
  pdfReference: 'pdf-forms/dir/das-140.pdf',
  agencyUrl: 'https://www.dir.ca.gov/das/PublicWorksForms.htm',
  notes:
    'Filed within 10 days of contract award on every public-works job over the apprentice threshold. Goes to the joint apprenticeship committee for each craft on the job.',
  fields: [
    f({ id: 'pdf-fld-das140-contractor-name', pdfFieldName: 'ContractorName', label: 'Contractor name', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-das140-cslb', pdfFieldName: 'ContractorLicenseNo', label: 'Contractor license #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'cslbLicense' } }),
    f({ id: 'pdf-fld-das140-dir', pdfFieldName: 'DIRRegistration', label: 'DIR registration #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'dirNumber' } }),
    f({ id: 'pdf-fld-das140-address', pdfFieldName: 'ContractorAddress', label: 'Contractor address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-das140-phone', pdfFieldName: 'ContractorPhone', label: 'Contractor phone', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'primaryPhone' } }),
    f({ id: 'pdf-fld-das140-email', pdfFieldName: 'ContractorEmail', label: 'Contractor email', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'primaryEmail' } }),
    f({ id: 'pdf-fld-das140-project-name', pdfFieldName: 'ProjectName', label: 'Project name', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Project name', sensitive: false } }),
    f({ id: 'pdf-fld-das140-project-number', pdfFieldName: 'ProjectNumber', label: 'Awarding agency project / contract #', kind: 'TEXT',
        source: { kind: 'prompt', label: 'Agency project #', sensitive: false } }),
    f({ id: 'pdf-fld-das140-awarding-body', pdfFieldName: 'AwardingBody', label: 'Awarding body', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Awarding body (CAL FIRE / Caltrans / Tehama County / ...)', sensitive: false } }),
    f({ id: 'pdf-fld-das140-craft', pdfFieldName: 'Craft', label: 'Craft (one form per craft)', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Craft (e.g. Operating Engineer Group 4)', sensitive: false } }),
    f({ id: 'pdf-fld-das140-est-journey-hours', pdfFieldName: 'EstimatedJourneymanHours', label: 'Estimated journeyman hours', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Estimated journeyman hours', hint: 'Hours per journeyman over the contract', sensitive: false } }),
    f({ id: 'pdf-fld-das140-contract-amount', pdfFieldName: 'ContractAmount', label: 'Contract amount', kind: 'TEXT',
        source: { kind: 'prompt', label: 'Contract award amount ($)', sensitive: false } }),
    f({ id: 'pdf-fld-das140-start', pdfFieldName: 'EstimatedStartDate', label: 'Estimated start date', kind: 'DATE',
        source: { kind: 'prompt', label: 'Estimated start date (yyyy-mm-dd)', sensitive: false } }),
    f({ id: 'pdf-fld-das140-end', pdfFieldName: 'EstimatedEndDate', label: 'Estimated completion date', kind: 'DATE',
        source: { kind: 'prompt', label: 'Estimated completion date (yyyy-mm-dd)', sensitive: false } }),
    f({ id: 'pdf-fld-das140-signature', pdfFieldName: 'Signature', label: 'Signature', kind: 'SIGNATURE', required: true,
        source: { kind: 'computed', name: 'profile.officers.vp.signature' } }),
    f({ id: 'pdf-fld-das140-date', pdfFieldName: 'SignatureDate', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- ACORD 25 (Certificate of Liability Insurance) --------------------

const ACORD_25: SeedMapping = {
  id: 'pdf-form-acord-25',
  displayName: 'ACORD 25 — Certificate of Liability Insurance',
  agency: 'ACORD',
  formCode: 'ACORD-25',
  versionDate: '2016-03-01',
  pdfReference: 'pdf-forms/acord/acord-25.pdf',
  agencyUrl: 'https://www.acord.org/forms/Pages/forms-library.aspx',
  notes:
    'Cert of insurance template every agency requests. Most fields draw from master-profile.insurance — filler picks the GL / auto / WC / umbrella policies in priority order.',
  fields: [
    f({ id: 'pdf-fld-acord-producer', pdfFieldName: 'PRODUCER', label: 'Producer (broker)', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'insurance.GENERAL_LIABILITY.brokerName' } }),
    f({ id: 'pdf-fld-acord-insured-name', pdfFieldName: 'INSURED', label: 'Insured (legal name)', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-acord-insured-address', pdfFieldName: 'INSURED_ADDRESS', label: 'Insured address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-acord-gl-carrier', pdfFieldName: 'INSR_A_INSURER', label: 'GL insurer name', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'insurance.GENERAL_LIABILITY.carrierName' } }),
    f({ id: 'pdf-fld-acord-gl-policy', pdfFieldName: 'POLICY_GL', label: 'GL policy #', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'insurance.GENERAL_LIABILITY.policyNumber' } }),
    f({ id: 'pdf-fld-acord-gl-eff', pdfFieldName: 'GL_EFF', label: 'GL effective', kind: 'DATE',
        source: { kind: 'profile-path', path: 'insurance.GENERAL_LIABILITY.effectiveDate' } }),
    f({ id: 'pdf-fld-acord-gl-exp', pdfFieldName: 'GL_EXP', label: 'GL expiration', kind: 'DATE',
        source: { kind: 'profile-path', path: 'insurance.GENERAL_LIABILITY.expiresOn' } }),
    f({ id: 'pdf-fld-acord-auto-carrier', pdfFieldName: 'INSR_B_INSURER', label: 'Auto insurer', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'insurance.AUTOMOBILE_LIABILITY.carrierName' } }),
    f({ id: 'pdf-fld-acord-auto-policy', pdfFieldName: 'POLICY_AUTO', label: 'Auto policy #', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'insurance.AUTOMOBILE_LIABILITY.policyNumber' } }),
    f({ id: 'pdf-fld-acord-wc-carrier', pdfFieldName: 'INSR_C_INSURER', label: 'WC insurer', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'insurance.WORKERS_COMP.carrierName' } }),
    f({ id: 'pdf-fld-acord-wc-policy', pdfFieldName: 'POLICY_WC', label: 'WC policy #', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'insurance.WORKERS_COMP.policyNumber' } }),
    f({ id: 'pdf-fld-acord-cert-holder', pdfFieldName: 'CERT_HOLDER', label: 'Certificate holder', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Certificate holder (agency / GC name + address)', sensitive: false } }),
    f({ id: 'pdf-fld-acord-cancellation', pdfFieldName: 'CANCELLATION', label: '30-day cancellation notice (already on certs by default)', kind: 'CHECKBOX',
        truthyValue: 'X',
        source: { kind: 'literal', value: 'true' } }),
    f({ id: 'pdf-fld-acord-date', pdfFieldName: 'DATE', label: 'Issue date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

const SEEDS: SeedMapping[] = [IRS_W9, DIR_DAS_140, ACORD_25];

/**
 * Realize a SeedMapping into a PdfFormMapping shape ready for the
 * store. The id stays as the seed's stable id so re-seeding is
 * idempotent (the store skips when the row already exists).
 */
export function buildSeedMapping(seed: SeedMapping, now: Date): PdfFormMapping {
  return {
    id: seed.id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    displayName: seed.displayName,
    agency: seed.agency,
    formCode: seed.formCode,
    versionDate: seed.versionDate,
    pdfReference: seed.pdfReference,
    agencyUrl: seed.agencyUrl,
    fields: seed.fields.map((field) => ({
      id: field.id ?? `pdf-fld-${seed.id}-${field.pdfFieldName}`.slice(0, 80),
      pdfFieldName: field.pdfFieldName,
      label: field.label,
      kind: field.kind,
      source: field.source,
      required: field.required ?? false,
      truthyValue: field.truthyValue,
      pattern: field.pattern,
    })),
    notes: seed.notes,
    reviewed: false,
  };
}

export function listSeedMappings(): SeedMapping[] {
  return SEEDS;
}
