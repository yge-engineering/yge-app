// Subcontractor substitution request — California Public Contract Code §4107.
//
// Plain English: once the prime contract is awarded, the prime is locked into
// using the subs we listed on the bid for their listed scopes. If a listed
// sub fails or refuses to execute the subcontract, becomes insolvent, loses
// their CSLB license, lets DIR registration lapse, or otherwise fails to
// perform, §4107 lets the prime ask the agency for permission to substitute
// in another sub. The original sub then has 5 working days to object; if
// they don't, the substitution is approved.
//
// This module builds a structured request letter from the prime (us) to the
// awarding agency. The letter names the failing sub, cites one of the
// statutory grounds, and proposes a replacement (when known). It does NOT
// notify the original sub — the statute says the agency does that. We do
// hand the agency a copy of our internal documentation though, so the
// "groundDetail" block lets the estimator paste in the underlying facts.

import { YGE_COMPANY_INFO, formatCompanyAddressOneLine } from './company';
import type { CompanyContact, CompanyInfo } from './company';
import { formatUSD } from './money';
import type { PricedEstimate } from './priced-estimate';
import type { SubBid } from './sub-bid';

/** Statutory grounds for substitution under PCC §4107(a). The labels are
 *  plain-English summaries; the statuteRef is the subsection. */
export type SubstitutionGround =
  | 'EXECUTE_FAILURE'
  | 'PERFORM_FAILURE'
  | 'BANKRUPTCY'
  | 'BOND_FAILURE'
  | 'LICENSE_LOSS'
  | 'DIR_REG_LAPSED'
  | 'MUTUAL_CONSENT'
  | 'COMPLIANCE_FAILURE';

interface GroundCopy {
  label: string;
  statuteRef: string;
  /** First-person body sentence we insert into the letter. */
  body: string;
}

const GROUND_COPY: Record<SubstitutionGround, GroundCopy> = {
  EXECUTE_FAILURE: {
    label: 'Failure or refusal to execute the written subcontract',
    statuteRef: 'PCC §4107(a)(1)',
    body: 'The listed subcontractor has failed or refused to execute a written subcontract for the work specified in its bid, after our reasonable written demand.',
  },
  PERFORM_FAILURE: {
    label: 'Failure or refusal to perform the listed work',
    statuteRef: 'PCC §4107(a)(3)',
    body: 'The listed subcontractor has failed or refused to perform the work specified in its bid, after our reasonable written demand.',
  },
  BANKRUPTCY: {
    label: 'Bankruptcy or insolvency',
    statuteRef: 'PCC §4107(a)(2)',
    body: 'The listed subcontractor has become bankrupt or insolvent and is unable to perform the contracted scope.',
  },
  BOND_FAILURE: {
    label: 'Failure to meet bond requirements',
    statuteRef: 'PCC §4107(a)(5)',
    body: 'The listed subcontractor has failed or refused to meet the bonding requirements set forth in the subcontract.',
  },
  LICENSE_LOSS: {
    label: 'License lapse, suspension, or revocation',
    statuteRef: 'PCC §4107(a)(6)',
    body: 'The listed subcontractor is not licensed under the Contractors State License Law for the work to be performed, or its license has lapsed, been suspended, or been revoked.',
  },
  DIR_REG_LAPSED: {
    label: 'DIR public-works registration lapsed',
    statuteRef: 'PCC §4107(a)(7)',
    body: 'The listed subcontractor is not registered with the Department of Industrial Relations as required under Labor Code §1725.5, or its registration has lapsed.',
  },
  MUTUAL_CONSENT: {
    label: 'Substitution by mutual consent',
    statuteRef: 'PCC §4107(a)(9)',
    body: 'The prime and the listed subcontractor have mutually agreed to the substitution and have furnished written consent to the awarding authority.',
  },
  COMPLIANCE_FAILURE: {
    label: 'Failure to comply with applicable statutes or regulations',
    statuteRef: 'PCC §4107(a)(4)',
    body: 'The listed subcontractor has failed or refused to comply with the applicable provisions of any law, including, but not limited to, those covering this public works project.',
  },
};

export function listSubstitutionGrounds(): ReadonlyArray<{
  value: SubstitutionGround;
  label: string;
  statuteRef: string;
}> {
  return (Object.keys(GROUND_COPY) as SubstitutionGround[]).map((value) => ({
    value,
    label: GROUND_COPY[value].label,
    statuteRef: GROUND_COPY[value].statuteRef,
  }));
}

export interface SubstitutionNoticeReplacement {
  /** Replacement sub's legal/DBA name. */
  contractorName: string;
  /** Single-line address — printed as-is. */
  address?: string;
  /** Replacement CSLB license number. */
  cslbLicense?: string;
  /** Replacement DIR public-works registration. */
  dirRegistration?: string;
  /** Replacement bid amount in cents. May differ from the original. */
  bidAmountCents?: number;
}

export interface SubstitutionNoticeOptions {
  /** Date that prints at the top. Defaults to "today" in en-US long form. */
  date?: string;
  /** Who signs. Defaults to the company VP (Ryan). */
  signer?: CompanyContact;
  /** Override the company info block. Defaults to YGE_COMPANY_INFO. */
  company?: CompanyInfo;
  /** Replacement sub. Optional — the prime can file the request and name
   *  the replacement later if no qualified sub has been lined up yet. */
  replacement?: SubstitutionNoticeReplacement;
  /** Free-form paragraph explaining the underlying facts (dates, demand
   *  letters sent, conversations, etc.). Pasted verbatim into the letter
   *  beneath the boilerplate ground statement. */
  groundDetail?: string;
  /** Optional override of the objection window the agency will give the
   *  original sub. Defaults to 5 — the statutory minimum. */
  objectionWindowWorkingDays?: number;
}

export interface SubstitutionNotice {
  date: string;
  subjectLine: string;
  companyHeader: {
    legalName: string;
    addressLine: string;
    cslbLicense: string;
    dirNumber: string;
    phone: string;
    email: string;
  };
  addressee: {
    agency: string;
    addressLines: string[];
  };
  salutation: string;
  /** Boilerplate first paragraphs in order. The renderer prints one per <p>. */
  bodyParagraphs: string[];
  originalSub: {
    contractorName: string;
    portionOfWork: string;
    bidAmountUsd: string;
    cslbLicense?: string;
    dirRegistration?: string;
  };
  ground: SubstitutionGround;
  groundLabel: string;
  groundStatuteRef: string;
  /** Boilerplate first-person statement of the ground for substitution. */
  groundStatement: string;
  /** Operator-supplied facts — optional. */
  groundDetail?: string;
  /** Replacement block — null when no replacement has been named yet. */
  replacementProposal: {
    contractorName: string;
    addressLines: string[];
    cslbLicense?: string;
    dirRegistration?: string;
    bidAmountUsd?: string;
  } | null;
  closingParagraph: string;
  closing: {
    line: string;
    signer: {
      name: string;
      title: string;
      company: string;
      phone: string;
      email: string;
    };
  };
}

function todayLong(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function splitAddress(addr: string | undefined): string[] {
  if (!addr) return [];
  return addr.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Build the §4107 substitution request letter for one listed sub on one
 *  awarded estimate, citing the chosen ground and (optionally) naming a
 *  replacement sub. */
export function buildSubstitutionNotice(
  estimate: Pick<PricedEstimate, 'projectName' | 'ownerAgency' | 'location'>,
  originalSub: SubBid,
  ground: SubstitutionGround,
  options: SubstitutionNoticeOptions = {},
): SubstitutionNotice {
  const company = options.company ?? YGE_COMPANY_INFO;
  const signer = options.signer ?? company.vicePresident;
  const date = options.date ?? todayLong();
  const window = options.objectionWindowWorkingDays ?? 5;

  const agency = estimate.ownerAgency ?? 'the Awarding Authority';
  const locationLine =
    estimate.location && estimate.location.trim().length > 0
      ? ` (${estimate.location})`
      : '';

  const groundCopy = GROUND_COPY[ground];

  const subjectLine = `Request for Subcontractor Substitution under ${groundCopy.statuteRef} — ${estimate.projectName}`;

  const bodyParagraphs: string[] = [
    `${company.legalName} is the prime contractor on ${estimate.projectName}${locationLine}, awarded by ${agency}. We hereby request the awarding authority's written consent under California Public Contract Code §4107 to substitute the subcontractor identified below.`,
    `Section §4107 requires that the awarding authority give the listed subcontractor at least ${window} working days' written notice of this request and an opportunity to submit written objection. We have prepared this letter for that purpose and stand ready to provide any additional documentation the authority requires.`,
  ];

  const closingParagraph = options.replacement
    ? `Our proposed replacement, named below, is licensed and registered to perform the listed scope and is prepared to execute the subcontract on the same material terms. Please direct any objections or questions to ${signer.name} at ${signer.phone} or ${signer.email}.`
    : `We will name a qualified replacement subcontractor for the listed scope as soon as the substitution is approved, and we will not commence the affected work until that replacement is on file with the authority. Please direct any objections or questions to ${signer.name} at ${signer.phone} or ${signer.email}.`;

  let replacementProposal: SubstitutionNotice['replacementProposal'] = null;
  if (options.replacement) {
    replacementProposal = {
      contractorName: options.replacement.contractorName,
      addressLines: splitAddress(options.replacement.address),
      cslbLicense: options.replacement.cslbLicense,
      dirRegistration: options.replacement.dirRegistration,
      bidAmountUsd:
        options.replacement.bidAmountCents != null
          ? formatUSD(options.replacement.bidAmountCents)
          : undefined,
    };
  }

  return {
    date,
    subjectLine,
    companyHeader: {
      legalName: company.legalName,
      addressLine: formatCompanyAddressOneLine(company),
      cslbLicense: company.cslbLicense,
      dirNumber: company.dirNumber,
      phone: signer.phone,
      email: signer.email,
    },
    addressee: {
      agency,
      addressLines: [],
    },
    salutation: 'To the Awarding Authority,',
    bodyParagraphs,
    originalSub: {
      contractorName: originalSub.contractorName,
      portionOfWork: originalSub.portionOfWork,
      bidAmountUsd: formatUSD(originalSub.bidAmountCents),
      cslbLicense: originalSub.cslbLicense,
      dirRegistration: originalSub.dirRegistration,
    },
    ground,
    groundLabel: groundCopy.label,
    groundStatuteRef: groundCopy.statuteRef,
    groundStatement: groundCopy.body,
    groundDetail: options.groundDetail?.trim() || undefined,
    replacementProposal,
    closingParagraph,
    closing: {
      line: 'Respectfully submitted,',
      signer: {
        name: signer.name,
        title: signer.title,
        company: company.legalName,
        phone: signer.phone,
        email: signer.email,
      },
    },
  };
}
