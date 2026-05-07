// Pre-mapped agency form library — seed data.
//
// Phase-1 starter set: IRS W-9, DIR DAS-140, ACORD 25 + expanded
// for CAL FIRE 720, DIR DAS-142, ACORD 27, ACORD 28.
//
// All seed mappings start with reviewed=false. An estimator flips
// the flag after sanity-checking the mapping against the agency's
// PDF; the form filler refuses to auto-fill un-reviewed mappings.
//
// pdfFieldName values are placeholder. Real PDFs need their AcroForm
// field names extracted — typically via pdftk dump_data_fields or
// pdf-lib getFields() against the actual byte stream.

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

const EIN_PATTERN = '^' + '\\d{2}-\\d{7}' + '$';

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
        pattern: EIN_PATTERN,
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
        source: { kind: 'prompt', label: 'Contract award amount', sensitive: false } }),
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

// ---- CAL FIRE 720 (Equipment Rate Form) --------------------------------

const CAL_FIRE_720: SeedMapping = {
  id: 'pdf-form-calfire-720',
  displayName: 'CAL FIRE 720 — Equipment / Vehicle Rate Form',
  agency: 'CAL_FIRE',
  formCode: 'CDF-720',
  versionDate: '2024-01-01',
  pdfReference: 'pdf-forms/cal-fire/cdf-720.pdf',
  agencyUrl: 'https://www.fire.ca.gov/programs/business-services/contracts/',
  notes:
    'CAL FIRE wildfire and forestry equipment rental rate registration. Goes with every CAL FIRE bid for engines, dozers, water tenders, fallers.',
  fields: [
    f({ id: 'pdf-fld-cf720-vendor', pdfFieldName: 'VendorName', label: 'Vendor / contractor name', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-cf720-cslb', pdfFieldName: 'ContractorLicense', label: 'CSLB license #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'cslbLicense' } }),
    f({ id: 'pdf-fld-cf720-fein', pdfFieldName: 'FEIN', label: 'Federal EIN', kind: 'TEXT', required: true,
        pattern: EIN_PATTERN,
        source: { kind: 'profile-path', path: 'federalEin' } }),
    f({ id: 'pdf-fld-cf720-address', pdfFieldName: 'Address', label: 'Mailing address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-cf720-phone', pdfFieldName: 'Phone', label: 'Phone', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'primaryPhone' } }),
    f({ id: 'pdf-fld-cf720-email', pdfFieldName: 'Email', label: 'Email', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'primaryEmail' } }),
    f({ id: 'pdf-fld-cf720-dot', pdfFieldName: 'USDOT', label: 'US DOT #', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'dotNumber' } }),
    f({ id: 'pdf-fld-cf720-equipment-type', pdfFieldName: 'EquipmentType', label: 'Equipment type / class', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Equipment type (e.g. Type 4 engine, D6 dozer)', sensitive: false } }),
    f({ id: 'pdf-fld-cf720-rate', pdfFieldName: 'HourlyRate', label: 'Hourly rate offered', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Hourly rate offered', sensitive: false } }),
    f({ id: 'pdf-fld-cf720-signature', pdfFieldName: 'Signature', label: 'Signature', kind: 'SIGNATURE', required: true,
        source: { kind: 'computed', name: 'profile.officers.president.signature' } }),
    f({ id: 'pdf-fld-cf720-date', pdfFieldName: 'SignatureDate', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- DIR DAS-142 (apprentice request + dispatch) ----------------------

const DIR_DAS_142: SeedMapping = {
  id: 'pdf-form-dir-das-142',
  displayName: 'DAS-142 — Request for Dispatch of an Apprentice',
  agency: 'CA_DIR',
  formCode: 'DAS-142',
  versionDate: '2023-04-01',
  pdfReference: 'pdf-forms/dir/das-142.pdf',
  agencyUrl: 'https://www.dir.ca.gov/das/PublicWorksForms.htm',
  notes:
    'Files 72 hours before apprentices are needed onsite. One per craft per JATC. Pairs with the DAS-140 already filed at award.',
  fields: [
    f({ id: 'pdf-fld-das142-contractor', pdfFieldName: 'ContractorName', label: 'Contractor name', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-das142-cslb', pdfFieldName: 'License', label: 'CSLB license #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'cslbLicense' } }),
    f({ id: 'pdf-fld-das142-dir', pdfFieldName: 'DIR', label: 'DIR #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'dirNumber' } }),
    f({ id: 'pdf-fld-das142-address', pdfFieldName: 'Address', label: 'Address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-das142-phone', pdfFieldName: 'Phone', label: 'Phone', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'primaryPhone' } }),
    f({ id: 'pdf-fld-das142-craft', pdfFieldName: 'Craft', label: 'Apprenticeable craft', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Apprenticeable craft', sensitive: false } }),
    f({ id: 'pdf-fld-das142-num', pdfFieldName: 'NumberRequested', label: 'Number apprentices requested', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Number apprentices requested', sensitive: false } }),
    f({ id: 'pdf-fld-das142-jobsite', pdfFieldName: 'JobSiteAddress', label: 'Jobsite address', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Jobsite address', sensitive: false } }),
    f({ id: 'pdf-fld-das142-start', pdfFieldName: 'NeedDate', label: 'Date apprentice needed', kind: 'DATE', required: true,
        source: { kind: 'prompt', label: 'Date apprentice needed (yyyy-mm-dd)', sensitive: false } }),
    f({ id: 'pdf-fld-das142-signature', pdfFieldName: 'Signature', label: 'Authorized signature', kind: 'SIGNATURE', required: true,
        source: { kind: 'computed', name: 'profile.officers.vp.signature' } }),
    f({ id: 'pdf-fld-das142-date', pdfFieldName: 'SignatureDate', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- ACORD 27 (Evidence of Property Insurance) ------------------------

const ACORD_27: SeedMapping = {
  id: 'pdf-form-acord-27',
  displayName: 'ACORD 27 — Evidence of Property Insurance',
  agency: 'ACORD',
  formCode: 'ACORD-27',
  versionDate: '2016-03-01',
  pdfReference: 'pdf-forms/acord/acord-27.pdf',
  agencyUrl: 'https://www.acord.org/forms/Pages/forms-library.aspx',
  notes:
    'Some county purchasing portals + lenders insist on ACORD 27 instead of 25 for property + builders-risk evidence.',
  fields: [
    f({ id: 'pdf-fld-acord27-producer', pdfFieldName: 'PRODUCER', label: 'Producer', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'insurance.PROPERTY.brokerName' } }),
    f({ id: 'pdf-fld-acord27-insured', pdfFieldName: 'INSURED', label: 'Named insured', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-acord27-address', pdfFieldName: 'INSURED_ADDRESS', label: 'Insured address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-acord27-carrier', pdfFieldName: 'CARRIER', label: 'Property carrier', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'insurance.PROPERTY.carrierName' } }),
    f({ id: 'pdf-fld-acord27-policy', pdfFieldName: 'POLICY_NUMBER', label: 'Property policy #', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'insurance.PROPERTY.policyNumber' } }),
    f({ id: 'pdf-fld-acord27-eff', pdfFieldName: 'EFFECTIVE', label: 'Effective', kind: 'DATE',
        source: { kind: 'profile-path', path: 'insurance.PROPERTY.effectiveDate' } }),
    f({ id: 'pdf-fld-acord27-exp', pdfFieldName: 'EXPIRES', label: 'Expires', kind: 'DATE',
        source: { kind: 'profile-path', path: 'insurance.PROPERTY.expiresOn' } }),
    f({ id: 'pdf-fld-acord27-holder', pdfFieldName: 'EVIDENCE_FOR', label: 'Evidence for (lender / agency)', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Evidence-for (lender or awarding body)', sensitive: false } }),
    f({ id: 'pdf-fld-acord27-date', pdfFieldName: 'DATE', label: 'Issue date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- ACORD 28 (Evidence of Commercial Property Insurance) ------------

const ACORD_28: SeedMapping = {
  id: 'pdf-form-acord-28',
  displayName: 'ACORD 28 — Evidence of Commercial Property Insurance',
  agency: 'ACORD',
  formCode: 'ACORD-28',
  versionDate: '2016-03-01',
  pdfReference: 'pdf-forms/acord/acord-28.pdf',
  agencyUrl: 'https://www.acord.org/forms/Pages/forms-library.aspx',
  notes:
    'Used when builders-risk on a specific job needs to be evidenced with multiple cert holders (owner, lender, GC).',
  fields: [
    f({ id: 'pdf-fld-acord28-producer', pdfFieldName: 'PRODUCER', label: 'Producer', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'insurance.BUILDERS_RISK.brokerName' } }),
    f({ id: 'pdf-fld-acord28-insured', pdfFieldName: 'INSURED', label: 'Named insured', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-acord28-address', pdfFieldName: 'INSURED_ADDRESS', label: 'Insured address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-acord28-carrier', pdfFieldName: 'CARRIER', label: 'Builders-risk carrier', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'insurance.BUILDERS_RISK.carrierName' } }),
    f({ id: 'pdf-fld-acord28-policy', pdfFieldName: 'POLICY_NUMBER', label: 'Builders-risk policy #', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'insurance.BUILDERS_RISK.policyNumber' } }),
    f({ id: 'pdf-fld-acord28-eff', pdfFieldName: 'EFFECTIVE', label: 'Effective', kind: 'DATE',
        source: { kind: 'profile-path', path: 'insurance.BUILDERS_RISK.effectiveDate' } }),
    f({ id: 'pdf-fld-acord28-exp', pdfFieldName: 'EXPIRES', label: 'Expires', kind: 'DATE',
        source: { kind: 'profile-path', path: 'insurance.BUILDERS_RISK.expiresOn' } }),
    f({ id: 'pdf-fld-acord28-job', pdfFieldName: 'JOB_DESCRIPTION', label: 'Job description', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Job description (project name + jobsite)', sensitive: false } }),
    f({ id: 'pdf-fld-acord28-holders', pdfFieldName: 'CERTIFICATE_HOLDERS', label: 'Certificate holders', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Certificate holders (owner / lender / GC, one per line)', sensitive: false } }),
    f({ id: 'pdf-fld-acord28-date', pdfFieldName: 'DATE', label: 'Issue date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};


// ---- DIR PWC-100 (Public Works Project award notice) -----------------

const DIR_PWC_100: SeedMapping = {
  id: 'pdf-form-dir-pwc-100',
  displayName: 'PWC-100 — Public Works Project Award Notice',
  agency: 'CA_DIR',
  formCode: 'PWC-100',
  versionDate: '2024-01-01',
  pdfReference: 'pdf-forms/dir/pwc-100.pdf',
  agencyUrl: 'https://www.dir.ca.gov/dlse/PWC100/PWC100.html',
  notes: 'Awarding agencies file this within 5 days of every public-works contract award.',
  fields: [
    f({ id: 'pdf-fld-pwc100-awarding-body', pdfFieldName: 'AwardingBody', label: 'Awarding body', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Awarding body legal name', sensitive: false } }),
    f({ id: 'pdf-fld-pwc100-project-name', pdfFieldName: 'ProjectName', label: 'Project name', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Project name', sensitive: false } }),
    f({ id: 'pdf-fld-pwc100-project-num', pdfFieldName: 'ProjectNumber', label: 'Awarding agency project / contract #', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Agency project / contract #', sensitive: false } }),
    f({ id: 'pdf-fld-pwc100-amount', pdfFieldName: 'ContractAmount', label: 'Contract amount', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Contract award amount', sensitive: false } }),
    f({ id: 'pdf-fld-pwc100-bid-date', pdfFieldName: 'BidOpenDate', label: 'Bid open date', kind: 'DATE', required: true,
        source: { kind: 'prompt', label: 'Bid open date (yyyy-mm-dd)', sensitive: false } }),
    f({ id: 'pdf-fld-pwc100-award-date', pdfFieldName: 'AwardDate', label: 'Award date', kind: 'DATE', required: true,
        source: { kind: 'prompt', label: 'Award date (yyyy-mm-dd)', sensitive: false } }),
    f({ id: 'pdf-fld-pwc100-contractor', pdfFieldName: 'Contractor', label: 'Awarded contractor', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-pwc100-cslb', pdfFieldName: 'License', label: 'CSLB license #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'cslbLicense' } }),
    f({ id: 'pdf-fld-pwc100-dir', pdfFieldName: 'DIR', label: 'DIR registration #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'dirNumber' } }),
    f({ id: 'pdf-fld-pwc100-jobsite', pdfFieldName: 'JobSiteAddress', label: 'Project location', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Project location (jobsite address)', sensitive: false } }),
  ],
};

// ---- IRS W-4 (Employee withholding) ----------------------------------

const IRS_W4: SeedMapping = {
  id: 'pdf-form-irs-w4',
  displayName: 'IRS W-4 — Employee Withholding Certificate',
  agency: 'IRS',
  formCode: 'W-4',
  versionDate: '2024-01-01',
  pdfReference: 'pdf-forms/irs/fw4.pdf',
  agencyUrl: 'https://www.irs.gov/pub/irs-pdf/fw4.pdf',
  notes: 'Every new hire fills this on day 1. Personal info prompts; employer block fills from master profile.',
  fields: [
    f({ id: 'pdf-fld-w4-employee-name', pdfFieldName: 'EmployeeName', label: 'Employee name', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Employee full legal name', sensitive: false } }),
    f({ id: 'pdf-fld-w4-ssn', pdfFieldName: 'SSN', label: 'Social security #', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Employee SSN', sensitive: true } }),
    f({ id: 'pdf-fld-w4-address', pdfFieldName: 'EmployeeAddress', label: 'Employee address', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Employee mailing address', sensitive: false } }),
    f({ id: 'pdf-fld-w4-marital', pdfFieldName: 'MaritalStatus', label: 'Filing status', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Single / Married / Head of household', sensitive: false } }),
    f({ id: 'pdf-fld-w4-employer-name', pdfFieldName: 'EmployerName', label: 'Employer name', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-w4-employer-address', pdfFieldName: 'EmployerAddress', label: 'Employer address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-w4-employer-ein', pdfFieldName: 'EmployerEIN', label: 'Employer EIN', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'federalEin' } }),
    f({ id: 'pdf-fld-w4-first-paid', pdfFieldName: 'FirstDatePaid', label: 'First date of employment', kind: 'DATE', required: true,
        source: { kind: 'prompt', label: 'First date paid (yyyy-mm-dd)', sensitive: false } }),
    f({ id: 'pdf-fld-w4-signature', pdfFieldName: 'EmployeeSignature', label: 'Employee signature', kind: 'SIGNATURE', required: true,
        source: { kind: 'prompt', label: 'Employee signature', sensitive: false } }),
    f({ id: 'pdf-fld-w4-date', pdfFieldName: 'SignatureDate', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- ACORD 30 (Higher Limits) ----------------------------------------

const ACORD_30: SeedMapping = {
  id: 'pdf-form-acord-30',
  displayName: 'ACORD 30 — Certificate of Liability with Higher Limits',
  agency: 'ACORD',
  formCode: 'ACORD-30',
  versionDate: '2016-03-01',
  pdfReference: 'pdf-forms/acord/acord-30.pdf',
  agencyUrl: 'https://www.acord.org/forms/Pages/forms-library.aspx',
  notes: 'Used when the awarding body requires excess / umbrella + auto + GL on a single cert with higher than ACORD 25 limits.',
  fields: [
    f({ id: 'pdf-fld-acord30-producer', pdfFieldName: 'PRODUCER', label: 'Producer', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'insurance.GENERAL_LIABILITY.brokerName' } }),
    f({ id: 'pdf-fld-acord30-insured', pdfFieldName: 'INSURED', label: 'Named insured', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-acord30-address', pdfFieldName: 'INSURED_ADDRESS', label: 'Insured address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-acord30-umbrella-carrier', pdfFieldName: 'UmbrellaCarrier', label: 'Umbrella / excess carrier', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'insurance.UMBRELLA.carrierName' } }),
    f({ id: 'pdf-fld-acord30-umbrella-policy', pdfFieldName: 'UmbrellaPolicy', label: 'Umbrella policy #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'insurance.UMBRELLA.policyNumber' } }),
    f({ id: 'pdf-fld-acord30-umbrella-limit', pdfFieldName: 'UmbrellaLimit', label: 'Umbrella each-occurrence limit', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'insurance.UMBRELLA.eachOccurrenceLimit' } }),
    f({ id: 'pdf-fld-acord30-cert-holder', pdfFieldName: 'CertHolder', label: 'Certificate holder', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Certificate holder (agency name + address)', sensitive: false } }),
    f({ id: 'pdf-fld-acord30-date', pdfFieldName: 'IssueDate', label: 'Issue date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- Caltrans Bidder Pre-Qualification ------------------------------

const CALTRANS_PREQUAL: SeedMapping = {
  id: 'pdf-form-caltrans-prequal',
  displayName: 'Caltrans Bidder Pre-Qualification (CEM-1101)',
  agency: 'CALTRANS',
  formCode: 'CEM-1101',
  versionDate: '2024-01-01',
  pdfReference: 'pdf-forms/caltrans/cem-1101.pdf',
  agencyUrl: 'https://dot.ca.gov/programs/construction/forms',
  notes: 'Annual contractor pre-qual on file with Caltrans. Required before bidding any state highway project.',
  fields: [
    f({ id: 'pdf-fld-caltrans-prequal-name', pdfFieldName: 'ContractorName', label: 'Contractor name', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-caltrans-prequal-address', pdfFieldName: 'Address', label: 'Address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-caltrans-prequal-cslb', pdfFieldName: 'License', label: 'CSLB license #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'cslbLicense' } }),
    f({ id: 'pdf-fld-caltrans-prequal-cslb-classes', pdfFieldName: 'Classifications', label: 'CSLB classifications', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.cslb.classifications.csv' } }),
    f({ id: 'pdf-fld-caltrans-prequal-dir', pdfFieldName: 'DIR', label: 'DIR registration #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'dirNumber' } }),
    f({ id: 'pdf-fld-caltrans-prequal-fein', pdfFieldName: 'FEIN', label: 'Federal EIN', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'federalEin' } }),
    f({ id: 'pdf-fld-caltrans-prequal-bond', pdfFieldName: 'BondingCapacity', label: 'Single-job bonding capacity', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'bonding.singleJobCapacityCents' } }),
    f({ id: 'pdf-fld-caltrans-prequal-aggregate', pdfFieldName: 'AggregateBonding', label: 'Aggregate bonding capacity', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'bonding.aggregateCapacityCents' } }),
    f({ id: 'pdf-fld-caltrans-prequal-officer', pdfFieldName: 'AuthorizedOfficer', label: 'Authorized officer', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.officers.president.name' } }),
    f({ id: 'pdf-fld-caltrans-prequal-signature', pdfFieldName: 'OfficerSignature', label: 'Officer signature', kind: 'SIGNATURE', required: true,
        source: { kind: 'computed', name: 'profile.officers.president.signature' } }),
    f({ id: 'pdf-fld-caltrans-prequal-date', pdfFieldName: 'SignatureDate', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

const SEEDS: SeedMapping[] = [
  IRS_W9,
  DIR_DAS_140,
  ACORD_25,
  CAL_FIRE_720,
  DIR_DAS_142,
  ACORD_27,
  ACORD_28,
  DIR_PWC_100,
  IRS_W4,
  ACORD_30,
  CALTRANS_PREQUAL,
];

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
