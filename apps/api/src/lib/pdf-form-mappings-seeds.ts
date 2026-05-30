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


// ---- DIR DAS-141 (affidavit of training contributions) -------------

const DIR_DAS_141: SeedMapping = {
  id: 'pdf-form-dir-das-141',
  displayName: 'DAS-141 — Apprenticeship Training Contribution Affidavit',
  agency: 'CA_DIR',
  formCode: 'DAS-141',
  versionDate: '2023-04-01',
  pdfReference: 'pdf-forms/dir/das-141.pdf',
  agencyUrl: 'https://www.dir.ca.gov/das/PublicWorksForms.htm',
  notes: 'Confirms training fund contributions paid (or owed) per craft on a public-works contract. Files alongside DAS-140 + 142 packet.',
  fields: [
    f({ id: 'pdf-fld-das141-contractor', pdfFieldName: 'ContractorName', label: 'Contractor name', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-das141-cslb', pdfFieldName: 'License', label: 'CSLB license #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'cslbLicense' } }),
    f({ id: 'pdf-fld-das141-dir', pdfFieldName: 'DIR', label: 'DIR registration #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'dirNumber' } }),
    f({ id: 'pdf-fld-das141-craft', pdfFieldName: 'Craft', label: 'Craft', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Craft', sensitive: false } }),
    f({ id: 'pdf-fld-das141-hours', pdfFieldName: 'JourneymanHours', label: 'Journeyman hours worked', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Total journeyman hours worked on contract', sensitive: false } }),
    f({ id: 'pdf-fld-das141-contributed', pdfFieldName: 'TrainingContributed', label: 'Training fund contribution paid', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Training fund $ contribution paid', sensitive: false } }),
    f({ id: 'pdf-fld-das141-recipient', pdfFieldName: 'RecipientFund', label: 'Recipient training fund', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Recipient training fund (or CAC if no JATC)', sensitive: false } }),
    f({ id: 'pdf-fld-das141-signature', pdfFieldName: 'Signature', label: 'Authorized signature', kind: 'SIGNATURE', required: true,
        source: { kind: 'computed', name: 'profile.officers.vp.signature' } }),
    f({ id: 'pdf-fld-das141-date', pdfFieldName: 'SignatureDate', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- USCIS I-9 (Employment eligibility) ----------------------------

const USCIS_I9: SeedMapping = {
  id: 'pdf-form-uscis-i9',
  displayName: 'USCIS I-9 — Employment Eligibility Verification',
  agency: 'US_DOL',
  formCode: 'I-9',
  versionDate: '2024-08-01',
  pdfReference: 'pdf-forms/uscis/i-9.pdf',
  agencyUrl: 'https://www.uscis.gov/i-9',
  notes: 'Required on first day of employment for every new hire (citizen or not). Section 1 by employee, Section 2 by employer within 3 business days.',
  fields: [
    f({ id: 'pdf-fld-i9-employee-name', pdfFieldName: 'EmployeeName', label: 'Employee name', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Employee full legal name', sensitive: false } }),
    f({ id: 'pdf-fld-i9-dob', pdfFieldName: 'DateOfBirth', label: 'Date of birth', kind: 'DATE', required: true,
        source: { kind: 'prompt', label: 'Employee date of birth', sensitive: true } }),
    f({ id: 'pdf-fld-i9-ssn', pdfFieldName: 'SSN', label: 'SSN', kind: 'TEXT',
        source: { kind: 'prompt', label: 'Employee SSN (optional unless E-Verify)', sensitive: true } }),
    f({ id: 'pdf-fld-i9-citizen', pdfFieldName: 'CitizenshipStatus', label: 'Citizenship status', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Citizenship status', sensitive: false } }),
    f({ id: 'pdf-fld-i9-employer-name', pdfFieldName: 'EmployerName', label: 'Employer name', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-i9-employer-address', pdfFieldName: 'EmployerAddress', label: 'Employer address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-i9-employer-ein', pdfFieldName: 'EmployerEIN', label: 'Employer EIN', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'federalEin' } }),
    f({ id: 'pdf-fld-i9-first-day', pdfFieldName: 'FirstDayOfEmployment', label: 'First day of employment', kind: 'DATE', required: true,
        source: { kind: 'prompt', label: 'First day of employment (yyyy-mm-dd)', sensitive: false } }),
    f({ id: 'pdf-fld-i9-employer-signature', pdfFieldName: 'EmployerSignature', label: 'Authorized representative signature', kind: 'SIGNATURE', required: true,
        source: { kind: 'computed', name: 'profile.officers.president.signature' } }),
    f({ id: 'pdf-fld-i9-employer-date', pdfFieldName: 'EmployerSignatureDate', label: 'Signature date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- EDD DE 4 (California Employee Withholding Allowance) ----------

const EDD_DE4: SeedMapping = {
  id: 'pdf-form-edd-de4',
  displayName: 'EDD DE 4 — Employee Withholding Allowance Certificate',
  agency: 'CA_FTB',
  formCode: 'DE-4',
  versionDate: '2024-01-01',
  pdfReference: 'pdf-forms/edd/de-4.pdf',
  agencyUrl: 'https://edd.ca.gov/pdf_pub_ctr/de4.pdf',
  notes: 'California state-tax companion to the federal W-4. Required for new hires + when an employee changes withholding.',
  fields: [
    f({ id: 'pdf-fld-de4-employee-name', pdfFieldName: 'EmployeeName', label: 'Employee name', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Employee full legal name', sensitive: false } }),
    f({ id: 'pdf-fld-de4-ssn', pdfFieldName: 'SSN', label: 'SSN', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Employee SSN', sensitive: true } }),
    f({ id: 'pdf-fld-de4-address', pdfFieldName: 'Address', label: 'Employee address', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Employee mailing address', sensitive: false } }),
    f({ id: 'pdf-fld-de4-marital', pdfFieldName: 'MaritalStatus', label: 'Marital status', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Single / Married / Head of household', sensitive: false } }),
    f({ id: 'pdf-fld-de4-allowances', pdfFieldName: 'Allowances', label: 'Total allowances', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Total state withholding allowances', sensitive: false } }),
    f({ id: 'pdf-fld-de4-employer-name', pdfFieldName: 'EmployerName', label: 'Employer name', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-de4-signature', pdfFieldName: 'EmployeeSignature', label: 'Employee signature', kind: 'SIGNATURE', required: true,
        source: { kind: 'prompt', label: 'Employee signature', sensitive: false } }),
    f({ id: 'pdf-fld-de4-date', pdfFieldName: 'SignatureDate', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- ACORD 855 (Notice of Cancellation) -----------------------------

const ACORD_855: SeedMapping = {
  id: 'pdf-form-acord-855',
  displayName: 'ACORD 855 — Notice of Cancellation',
  agency: 'ACORD',
  formCode: 'ACORD-855',
  versionDate: '2016-03-01',
  pdfReference: 'pdf-forms/acord/acord-855.pdf',
  agencyUrl: 'https://www.acord.org/forms/Pages/forms-library.aspx',
  notes: 'Used to notify a certificate holder that a policy has been or will be cancelled. YGE rarely originates this; usually receives them from carriers.',
  fields: [
    f({ id: 'pdf-fld-acord855-producer', pdfFieldName: 'PRODUCER', label: 'Producer', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'insurance.GENERAL_LIABILITY.brokerName' } }),
    f({ id: 'pdf-fld-acord855-insured', pdfFieldName: 'INSURED', label: 'Named insured', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-acord855-policy', pdfFieldName: 'POLICY_NUMBER', label: 'Policy number', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Policy number being cancelled', sensitive: false } }),
    f({ id: 'pdf-fld-acord855-effective', pdfFieldName: 'CANCEL_EFFECTIVE', label: 'Cancellation effective', kind: 'DATE', required: true,
        source: { kind: 'prompt', label: 'Cancellation effective date', sensitive: false } }),
    f({ id: 'pdf-fld-acord855-reason', pdfFieldName: 'REASON', label: 'Reason', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Reason for cancellation', sensitive: false } }),
    f({ id: 'pdf-fld-acord855-holder', pdfFieldName: 'CERT_HOLDER', label: 'Certificate holder', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Certificate holder name + address', sensitive: false } }),
    f({ id: 'pdf-fld-acord855-date', pdfFieldName: 'NoticeDate', label: 'Notice date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- CA Non-Collusion Affidavit (PCC §7106) ---------------------------
//
// Required on every public-works bid in California. Caltrans + most
// counties use a near-identical one-page form. This mapping is the
// generic version; agency-specific variants can clone it later.

const CA_NON_COLLUSION_AFFIDAVIT: SeedMapping = {
  id: 'pdf-form-ca-non-collusion-affidavit',
  displayName: 'CA Non-Collusion Affidavit (PCC §7106)',
  agency: 'CA_DGS',
  formCode: 'NCA-7106',
  pdfReference: 'pdf-forms/ca/non-collusion-affidavit.pdf',
  notes:
    'Required on every public-works bid per PCC §7106. Sworn statement that the bidder did not collude with other bidders, kept the bid confidential, paid no fees to suppress competition. Notarization is usually required by the agency — leave the notary block blank for the in-person sign.',
  fields: [
    f({ id: 'pdf-fld-nca-state-of', pdfFieldName: 'StateOf', label: 'State of', kind: 'TEXT', required: true,
        source: { kind: 'literal', value: 'California' } }),
    f({ id: 'pdf-fld-nca-county-of', pdfFieldName: 'CountyOf', label: 'County of', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'address.county' } }),
    f({ id: 'pdf-fld-nca-affiant-name', pdfFieldName: 'AffiantName', label: 'Affiant (signer) name', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.officers.vp.signature' } }),
    f({ id: 'pdf-fld-nca-affiant-title', pdfFieldName: 'AffiantTitle', label: 'Affiant title', kind: 'TEXT', required: true,
        source: { kind: 'literal', value: 'Vice President' } }),
    f({ id: 'pdf-fld-nca-bidder-name', pdfFieldName: 'BidderName', label: 'Bidder name (legal)', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-nca-bidder-address', pdfFieldName: 'BidderAddress', label: 'Bidder address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-nca-project-name', pdfFieldName: 'ProjectName', label: 'Project name', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Project name', sensitive: false } }),
    f({ id: 'pdf-fld-nca-project-number', pdfFieldName: 'ProjectNumber', label: 'Project / contract #', kind: 'TEXT',
        source: { kind: 'prompt', label: 'Project / contract #', sensitive: false } }),
    f({ id: 'pdf-fld-nca-signature', pdfFieldName: 'Signature', label: 'Signature', kind: 'SIGNATURE', required: true,
        source: { kind: 'computed', name: 'profile.officers.vp.signature' } }),
    f({ id: 'pdf-fld-nca-date', pdfFieldName: 'Date', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- Iran Contracting Act Certification (PCC §2204) -------------------
//
// Required on any CA public-agency bid > $1,000,000 (or any contract
// with a state agency for goods or services from companies doing
// business with the Iranian energy sector). YGE is not on the §2203
// exclusion list, so the certification is just a checkbox + signature.

const CA_IRAN_CONTRACTING_ACT: SeedMapping = {
  id: 'pdf-form-ca-iran-contracting-act',
  displayName: 'CA Iran Contracting Act Certification (PCC §2204)',
  agency: 'CA_DGS',
  formCode: 'ICA-2204',
  pdfReference: 'pdf-forms/ca/iran-contracting-act.pdf',
  notes:
    'Required on any CA public-works bid > $1M. YGE certifies it is NOT identified on the DGS §2203 exclusion list of companies doing business in the Iranian energy sector. Bidder checks one of two boxes (not on list / on list with exemption); fills name + license + signature.',
  fields: [
    f({ id: 'pdf-fld-ica-bidder-name', pdfFieldName: 'BidderName', label: 'Bidder legal name', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-ica-cslb', pdfFieldName: 'CslbLicense', label: 'CSLB license #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'cslbLicense' } }),
    f({ id: 'pdf-fld-ica-address', pdfFieldName: 'BidderAddress', label: 'Bidder address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-ica-not-on-list', pdfFieldName: 'NotOnExclusionList', label: 'Not on DGS §2203 exclusion list', kind: 'CHECKBOX', required: true,
        source: { kind: 'literal', value: 'true' }, truthyValue: 'Yes' }),
    f({ id: 'pdf-fld-ica-project', pdfFieldName: 'ProjectName', label: 'Project name', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Project name', sensitive: false } }),
    f({ id: 'pdf-fld-ica-signature', pdfFieldName: 'Signature', label: 'Authorized signer', kind: 'SIGNATURE', required: true,
        source: { kind: 'computed', name: 'profile.officers.vp.signature' } }),
    f({ id: 'pdf-fld-ica-title', pdfFieldName: 'SignerTitle', label: 'Title', kind: 'TEXT', required: true,
        source: { kind: 'literal', value: 'Vice President' } }),
    f({ id: 'pdf-fld-ica-date', pdfFieldName: 'Date', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- CA Drug-Free Workplace Certification (Gov Code §8350-8357) ------

const CA_DRUG_FREE_WORKPLACE: SeedMapping = {
  id: 'pdf-form-ca-drug-free-workplace',
  displayName: 'CA Drug-Free Workplace Certification (Gov Code §8350)',
  agency: 'CA_DGS',
  formCode: 'DFW-8350',
  pdfReference: 'pdf-forms/ca/drug-free-workplace.pdf',
  notes:
    'Required on every CA agency contract or grant per Gov Code §8350-8357. YGE certifies it maintains a drug-free workplace per the statute: published policy, employee notice, awareness program, post-conviction reporting. Single signature, no notarization.',
  fields: [
    f({ id: 'pdf-fld-dfw-contractor-name', pdfFieldName: 'ContractorName', label: 'Contractor name', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-dfw-address', pdfFieldName: 'ContractorAddress', label: 'Contractor address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-dfw-project-name', pdfFieldName: 'ProjectName', label: 'Project / contract name', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Project / contract name', sensitive: false } }),
    f({ id: 'pdf-fld-dfw-cert-published', pdfFieldName: 'PublishedStatement', label: 'Published statement notifying employees', kind: 'CHECKBOX', required: true,
        source: { kind: 'literal', value: 'true' }, truthyValue: 'Yes' }),
    f({ id: 'pdf-fld-dfw-cert-program', pdfFieldName: 'AwarenessProgram', label: 'Established drug-free awareness program', kind: 'CHECKBOX', required: true,
        source: { kind: 'literal', value: 'true' }, truthyValue: 'Yes' }),
    f({ id: 'pdf-fld-dfw-cert-notify', pdfFieldName: 'EmployeeNoticeProcess', label: 'Employee notice / post-conviction reporting', kind: 'CHECKBOX', required: true,
        source: { kind: 'literal', value: 'true' }, truthyValue: 'Yes' }),
    f({ id: 'pdf-fld-dfw-signature', pdfFieldName: 'Signature', label: 'Authorized signer', kind: 'SIGNATURE', required: true,
        source: { kind: 'computed', name: 'profile.officers.vp.signature' } }),
    f({ id: 'pdf-fld-dfw-title', pdfFieldName: 'SignerTitle', label: 'Title', kind: 'TEXT', required: true,
        source: { kind: 'literal', value: 'Vice President' } }),
    f({ id: 'pdf-fld-dfw-date', pdfFieldName: 'Date', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- CA Workers Comp Certification (Labor Code §1861) -----------------

const CA_WORKERS_COMP_AFFIDAVIT: SeedMapping = {
  id: 'pdf-form-ca-workers-comp-affidavit',
  displayName: 'CA Workers Comp Certification (Labor Code §1861)',
  agency: 'CA_DGS',
  formCode: 'WC-1861',
  pdfReference: 'pdf-forms/ca/workers-comp-1861.pdf',
  notes:
    'Required on every CA public-works contract per Labor Code §3700 + §1861. YGE certifies it carries workers comp covering all employees on the work. Pulls the WC carrier + policy from the master profile.',
  fields: [
    f({ id: 'pdf-fld-wc-contractor-name', pdfFieldName: 'ContractorName', label: 'Contractor name', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-wc-cslb', pdfFieldName: 'CslbLicense', label: 'CSLB license #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'cslbLicense' } }),
    f({ id: 'pdf-fld-wc-carrier', pdfFieldName: 'WcCarrierName', label: 'WC carrier', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'insurance.WORKERS_COMP.carrierName' } }),
    f({ id: 'pdf-fld-wc-policy', pdfFieldName: 'WcPolicyNumber', label: 'WC policy #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'insurance.WORKERS_COMP.policyNumber' } }),
    f({ id: 'pdf-fld-wc-expiry', pdfFieldName: 'WcExpiry', label: 'WC policy expiry', kind: 'DATE', required: true,
        source: { kind: 'profile-path', path: 'insurance.WORKERS_COMP.expiresOn' } }),
    f({ id: 'pdf-fld-wc-project', pdfFieldName: 'ProjectName', label: 'Project name', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Project name', sensitive: false } }),
    f({ id: 'pdf-fld-wc-signature', pdfFieldName: 'Signature', label: 'Authorized signer', kind: 'SIGNATURE', required: true,
        source: { kind: 'computed', name: 'profile.officers.vp.signature' } }),
    f({ id: 'pdf-fld-wc-title', pdfFieldName: 'SignerTitle', label: 'Title', kind: 'TEXT', required: true,
        source: { kind: 'literal', value: 'Vice President' } }),
    f({ id: 'pdf-fld-wc-date', pdfFieldName: 'Date', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- CalRecycle Recycled Content Certification (PCC §12200) ----------

const CALRECYCLE_RECYCLED_CONTENT: SeedMapping = {
  id: 'pdf-form-calrecycle-recycled-content',
  displayName: 'CalRecycle Recycled-Content Certification (PCC §12200)',
  agency: 'CA_DGS',
  formCode: 'CIWMB-74',
  pdfReference: 'pdf-forms/ca/calrecycle-recycled-content.pdf',
  agencyUrl: 'https://calrecycle.ca.gov/buyrecycled/sabrcprogram/',
  notes:
    'CA Public Contract Code §12200-12217 requires every state contract or purchase order to certify the recycled content of paper / plastic / glass / lubricants supplied. YGE typically certifies "no SABRC-eligible materials supplied" on civil-construction bids; the form still has to be on file.',
  fields: [
    f({ id: 'pdf-fld-rcc-contractor-name', pdfFieldName: 'ContractorName', label: 'Contractor name', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-rcc-address', pdfFieldName: 'Address', label: 'Address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-rcc-phone', pdfFieldName: 'Phone', label: 'Phone', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'primaryPhone' } }),
    f({ id: 'pdf-fld-rcc-cslb', pdfFieldName: 'CslbLicense', label: 'CSLB license #', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'cslbLicense' } }),
    f({ id: 'pdf-fld-rcc-contract-num', pdfFieldName: 'ContractNumber', label: 'Contract / project #', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Contract / project #', sensitive: false } }),
    f({ id: 'pdf-fld-rcc-product-type', pdfFieldName: 'ProductType', label: 'Product type', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Product type (or "no SABRC-eligible materials supplied")', sensitive: false, hint: 'Civil construction bids typically list nothing here.' } }),
    f({ id: 'pdf-fld-rcc-postconsumer-pct', pdfFieldName: 'PostConsumerPct', label: 'Post-consumer recycled content %', kind: 'TEXT',
        source: { kind: 'prompt', label: 'Post-consumer recycled content %', sensitive: false } }),
    f({ id: 'pdf-fld-rcc-secondary-pct', pdfFieldName: 'SecondaryRecycledPct', label: 'Secondary recycled %', kind: 'TEXT',
        source: { kind: 'prompt', label: 'Secondary recycled content %', sensitive: false } }),
    f({ id: 'pdf-fld-rcc-signature', pdfFieldName: 'Signature', label: 'Authorized signer', kind: 'SIGNATURE', required: true,
        source: { kind: 'computed', name: 'profile.officers.vp.signature' } }),
    f({ id: 'pdf-fld-rcc-title', pdfFieldName: 'SignerTitle', label: 'Title', kind: 'TEXT', required: true,
        source: { kind: 'literal', value: 'Vice President' } }),
    f({ id: 'pdf-fld-rcc-date', pdfFieldName: 'Date', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- FHWA-1273 (Federal-Aid Required Contract Provisions) --------------

const FHWA_1273: SeedMapping = {
  id: 'pdf-form-fhwa-1273',
  displayName: 'FHWA-1273 — Federal-Aid Required Contract Provisions',
  agency: 'US_DOL',  // technically FHWA / USDOT but US_DOL is closest enum
  formCode: 'FHWA-1273',
  versionDate: '2024-05-01',
  pdfReference: 'pdf-forms/federal/fhwa-1273.pdf',
  agencyUrl: 'https://www.fhwa.dot.gov/programadmin/contracts/1273.cfm',
  notes:
    'Required attachment on every federally-funded highway contract — includes equal opportunity, Davis-Bacon wage compliance, contract work hours, false statements provisions. YGE acknowledges by signature; pre-fills contractor identity + signature block, the rest of the body is the agency-supplied boilerplate.',
  fields: [
    f({ id: 'pdf-fld-fhwa-contractor', pdfFieldName: 'ContractorName', label: 'Contractor name', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-fhwa-address', pdfFieldName: 'ContractorAddress', label: 'Contractor address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-fhwa-cslb', pdfFieldName: 'CslbLicense', label: 'CSLB license #', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'cslbLicense' } }),
    f({ id: 'pdf-fld-fhwa-dot', pdfFieldName: 'UsdotNumber', label: 'USDOT #', kind: 'TEXT',
        source: { kind: 'profile-path', path: 'dotNumber' } }),
    f({ id: 'pdf-fld-fhwa-project-name', pdfFieldName: 'ProjectName', label: 'Project name', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Project name', sensitive: false } }),
    f({ id: 'pdf-fld-fhwa-fed-project-num', pdfFieldName: 'FederalProjectNumber', label: 'Federal-aid project #', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Federal-aid project # (per agency notice)', sensitive: false } }),
    f({ id: 'pdf-fld-fhwa-state-project-num', pdfFieldName: 'StateProjectNumber', label: 'State project #', kind: 'TEXT',
        source: { kind: 'prompt', label: 'State project # (Caltrans EA number, etc.)', sensitive: false } }),
    f({ id: 'pdf-fld-fhwa-ack', pdfFieldName: 'AcknowledgeProvisions', label: 'Acknowledge required provisions', kind: 'CHECKBOX', required: true,
        source: { kind: 'literal', value: 'true' }, truthyValue: 'Yes' }),
    f({ id: 'pdf-fld-fhwa-signature', pdfFieldName: 'Signature', label: 'Authorized signer', kind: 'SIGNATURE', required: true,
        source: { kind: 'computed', name: 'profile.officers.vp.signature' } }),
    f({ id: 'pdf-fld-fhwa-title', pdfFieldName: 'SignerTitle', label: 'Title', kind: 'TEXT', required: true,
        source: { kind: 'literal', value: 'Vice President' } }),
    f({ id: 'pdf-fld-fhwa-date', pdfFieldName: 'Date', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- Caltrans CEM-1102 disqualifications affidavit -----------------------

const CALTRANS_DISQUALIFICATIONS: SeedMapping = {
  id: 'pdf-form-caltrans-cem-1102',
  displayName: 'Caltrans Past Contract Disqualifications (CEM-1102)',
  agency: 'CALTRANS',
  formCode: 'CEM-1102',
  versionDate: '2024-01-01',
  pdfReference: 'pdf-forms/caltrans/cem-1102.pdf',
  agencyUrl: 'https://dot.ca.gov/programs/construction/forms',
  notes:
    'Bidder declares whether they have been disqualified, suspended, or debarred from any public-works contract in the prior 5 years (PCC §6109 + §10162). Required on every Caltrans bid. Default declaration is "no" — operator confirms inline. Yes triggers a prompt for the agency + date detail.',
  fields: [
    f({ id: 'pdf-fld-caltrans-1102-contractor', pdfFieldName: 'ContractorName', label: 'Contractor name', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'legalName' } }),
    f({ id: 'pdf-fld-caltrans-1102-cslb', pdfFieldName: 'License', label: 'CSLB license #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'cslbLicense' } }),
    f({ id: 'pdf-fld-caltrans-1102-dir', pdfFieldName: 'DIR', label: 'DIR registration #', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'dirNumber' } }),
    f({ id: 'pdf-fld-caltrans-1102-address', pdfFieldName: 'BidderAddress', label: 'Bidder address', kind: 'TEXT', required: true,
        source: { kind: 'computed', name: 'profile.address.oneLine' } }),
    f({ id: 'pdf-fld-caltrans-1102-phone', pdfFieldName: 'Phone', label: 'Phone', kind: 'TEXT', required: true,
        source: { kind: 'profile-path', path: 'primaryPhone' } }),
    f({ id: 'pdf-fld-caltrans-1102-project', pdfFieldName: 'ProjectName', label: 'Project name', kind: 'TEXT', required: true,
        source: { kind: 'prompt', label: 'Project name (per bid notice)', sensitive: false } }),
    f({ id: 'pdf-fld-caltrans-1102-ea', pdfFieldName: 'EaNumber', label: 'Caltrans EA number', kind: 'TEXT',
        source: { kind: 'prompt', label: 'Caltrans EA # (Expense Authorization)', sensitive: false } }),
    f({ id: 'pdf-fld-caltrans-1102-not-disqualified', pdfFieldName: 'NotDisqualified', label: 'Not disqualified / suspended / debarred (last 5 yrs)', kind: 'CHECKBOX', required: true,
        source: { kind: 'literal', value: 'true' }, truthyValue: 'Yes' }),
    f({ id: 'pdf-fld-caltrans-1102-detail', pdfFieldName: 'DisqualificationDetail', label: 'If yes — agency, date, reason', kind: 'TEXT',
        source: { kind: 'prompt', label: 'Detail (agency, date, reason) — leave blank if no disqualifications', sensitive: false } }),
    f({ id: 'pdf-fld-caltrans-1102-signature', pdfFieldName: 'Signature', label: 'Authorized signer', kind: 'SIGNATURE', required: true,
        source: { kind: 'computed', name: 'profile.officers.vp.signature' } }),
    f({ id: 'pdf-fld-caltrans-1102-title', pdfFieldName: 'SignerTitle', label: 'Title', kind: 'TEXT', required: true,
        source: { kind: 'literal', value: 'Vice President' } }),
    f({ id: 'pdf-fld-caltrans-1102-date', pdfFieldName: 'Date', label: 'Date', kind: 'DATE', required: true,
        source: { kind: 'computed', name: 'date.today.us' } }),
  ],
};

// ---- Shasta + Tehama county bidder affidavits (now via the generator) ----
//
// Bundles 2621/2622 hand-crafted these. Bundle 2623 promoted the
// pattern to makeCountyBidderAffidavit(). Bundle 2624 (this one)
// kills the duplication so Shasta + Tehama go through the same
// generator as the other five NorCal counties — single source of
// truth for the county-affidavit shape.

// ---- County bidder affidavit generator --------------------------------
//
// The 7 NorCal counties YGE works in all use a near-identical
// bidder affidavit (contractor identity + CSLB + DIR +
// debarment + bid bond + signature). Hand-crafting each was
// boilerplate noise — this generator keeps them DRY. Add a new
// county by appending one entry to COUNTIES below.

interface CountyMeta {
  /** Slug used for ids + filenames (no spaces). */
  slug: string;
  /** Display name as it should appear in the UI ("Shasta County"). */
  display: string;
  /** Agency homepage URL for the office that issues the form. */
  agencyUrl: string;
}

function makeCountyBidderAffidavit(c: CountyMeta): SeedMapping {
  return {
    id: `pdf-form-${c.slug}-county-bidder-affidavit`,
    displayName: `${c.display} Bidder Affidavit`,
    agency: 'COUNTY',
    formCode: `${c.slug.toUpperCase()}-BID-AFFIDAVIT`,
    pdfReference: `pdf-forms/county/${c.slug}-bidder-affidavit.pdf`,
    agencyUrl: c.agencyUrl,
    notes:
      `${c.display} variant of the standard NorCal county bidder affidavit. ` +
      `Contractor identity + CSLB + DIR + debarment + bid bond enclosed + ` +
      `signature. Notarization required for bids over the formal-advertising threshold.`,
    fields: [
      f({ id: `pdf-fld-${c.slug}-bidder-name`, pdfFieldName: 'BidderName', label: 'Bidder name (legal)', kind: 'TEXT', required: true,
          source: { kind: 'profile-path', path: 'legalName' } }),
      f({ id: `pdf-fld-${c.slug}-cslb`, pdfFieldName: 'CslbLicense', label: 'CSLB license #', kind: 'TEXT', required: true,
          source: { kind: 'profile-path', path: 'cslbLicense' } }),
      f({ id: `pdf-fld-${c.slug}-cslb-classes`, pdfFieldName: 'CslbClassifications', label: 'CSLB classifications', kind: 'TEXT',
          source: { kind: 'profile-path', path: 'cslbClassifications' } }),
      f({ id: `pdf-fld-${c.slug}-dir`, pdfFieldName: 'DirRegistration', label: 'DIR registration #', kind: 'TEXT', required: true,
          source: { kind: 'profile-path', path: 'dirNumber' } }),
      f({ id: `pdf-fld-${c.slug}-address`, pdfFieldName: 'BidderAddress', label: 'Bidder address', kind: 'TEXT', required: true,
          source: { kind: 'computed', name: 'profile.address.oneLine' } }),
      f({ id: `pdf-fld-${c.slug}-phone`, pdfFieldName: 'Phone', label: 'Phone', kind: 'TEXT', required: true,
          source: { kind: 'profile-path', path: 'primaryPhone' } }),
      f({ id: `pdf-fld-${c.slug}-email`, pdfFieldName: 'Email', label: 'Email', kind: 'TEXT', required: true,
          source: { kind: 'profile-path', path: 'primaryEmail' } }),
      f({ id: `pdf-fld-${c.slug}-project`, pdfFieldName: 'ProjectName', label: 'Project name', kind: 'TEXT', required: true,
          source: { kind: 'prompt', label: 'Project name', sensitive: false } }),
      f({ id: `pdf-fld-${c.slug}-project-num`, pdfFieldName: 'ProjectNumber', label: 'County project #', kind: 'TEXT',
          source: { kind: 'prompt', label: 'County project # (per bid notice)', sensitive: false } }),
      f({ id: `pdf-fld-${c.slug}-not-debarred`, pdfFieldName: 'NotDebarred', label: 'Not debarred or suspended', kind: 'CHECKBOX', required: true,
          source: { kind: 'literal', value: 'true' }, truthyValue: 'Yes' }),
      f({ id: `pdf-fld-${c.slug}-bid-bond-on-file`, pdfFieldName: 'BidBondOnFile', label: 'Bid bond / cashier\'s check enclosed', kind: 'CHECKBOX', required: true,
          source: { kind: 'literal', value: 'true' }, truthyValue: 'Yes' }),
      f({ id: `pdf-fld-${c.slug}-signature`, pdfFieldName: 'Signature', label: 'Authorized signer', kind: 'SIGNATURE', required: true,
          source: { kind: 'computed', name: 'profile.officers.vp.signature' } }),
      f({ id: `pdf-fld-${c.slug}-title`, pdfFieldName: 'SignerTitle', label: 'Title', kind: 'TEXT', required: true,
          source: { kind: 'literal', value: 'Vice President' } }),
      f({ id: `pdf-fld-${c.slug}-date`, pdfFieldName: 'Date', label: 'Date', kind: 'DATE', required: true,
          source: { kind: 'computed', name: 'date.today.us' } }),
    ],
  };
}

const NORCAL_COUNTIES: CountyMeta[] = [
  { slug: 'shasta', display: 'Shasta County',
    agencyUrl: 'https://www.shastacounty.gov/public-works/page/bids-proposals' },
  { slug: 'tehama', display: 'Tehama County',
    agencyUrl: 'https://www.co.tehama.ca.us/department-pages/public-works' },
  { slug: 'glenn', display: 'Glenn County',
    agencyUrl: 'https://www.countyofglenn.net/dept/public-works' },
  { slug: 'lassen', display: 'Lassen County',
    agencyUrl: 'https://www.lassencounty.org/dept/public-works' },
  { slug: 'siskiyou', display: 'Siskiyou County',
    agencyUrl: 'https://www.co.siskiyou.ca.us/publicworks' },
  { slug: 'modoc', display: 'Modoc County',
    agencyUrl: 'https://www.co.modoc.ca.us/departments/public-works' },
  { slug: 'butte', display: 'Butte County',
    agencyUrl: 'https://www.buttecounty.net/publicworks' },
];

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
  DIR_DAS_141,
  USCIS_I9,
  EDD_DE4,
  ACORD_855,
  CA_NON_COLLUSION_AFFIDAVIT,
  CA_IRAN_CONTRACTING_ACT,
  CA_DRUG_FREE_WORKPLACE,
  CA_WORKERS_COMP_AFFIDAVIT,
  CALRECYCLE_RECYCLED_CONTENT,
  FHWA_1273,
  CALTRANS_DISQUALIFICATIONS,
  ...NORCAL_COUNTIES.map(makeCountyBidderAffidavit),
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
