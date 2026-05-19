// Subcontractor award notice builder.
//
// Plain English: once an agency awards us the prime contract, every sub we
// listed on the §4104 form needs a short letter saying "you're locked in for
// the listed scope at the listed price; here's what we need from you before
// we issue a PO." Sub gets this on company letterhead, signed by an officer,
// dated. Sub countersigns the bottom and returns it as the binder while
// legal drafts the subcontract.
//
// Design mirrors `transmittal.ts`: a pure function returns a structured
// letter object. The web view renders it on letterhead; later, the AP PDF
// generator can use the same shape to produce a sealed packet.

import { YGE_COMPANY_INFO, formatCompanyAddressOneLine } from './company';
import type { CompanyContact, CompanyInfo } from './company';
import { formatUSD } from './money';
import type { PricedEstimate } from './priced-estimate';
import type { SubBid } from './sub-bid';

export interface SubAwardNoticeOptions {
  /** Date that prints at the top. Defaults to "today" in en-US long form.
   *  Tests pin this for stable snapshots. */
  date?: string;
  /** Who signs. Defaults to the company VP (Ryan). */
  signer?: CompanyContact;
  /** Override the company info block. Defaults to YGE_COMPANY_INFO. */
  company?: CompanyInfo;
  /** Optional override of the response window in business days. Defaults
   *  to 10 — that's the standard "execute or we substitute" window §4107
   *  builds around. */
  responseWindowBusinessDays?: number;
}

export interface SubAwardNoticeAddressee {
  contractorName: string;
  addressLines: string[];
  cslbLicense?: string;
  dirRegistration?: string;
}

export interface SubAwardNoticeScopeBlock {
  portionOfWork: string;
  bidAmountUsd: string;
}

export interface SubAwardNotice {
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
  addressee: SubAwardNoticeAddressee;
  salutation: string;
  /** Top of the letter, in order. One <p> per entry. */
  bodyParagraphs: string[];
  /** The "Awarded scope" block printed in bold under the body. */
  scopeBlock: SubAwardNoticeScopeBlock;
  /** Numbered "Before we issue a PO we need:" items. */
  nextSteps: string[];
  /** Final paragraph (typically the §4107 reminder + thank-you). */
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
  /** Countersignature block printed at the bottom for the sub. */
  countersignaturePrompt: string;
}

function todayLong(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Build a single award-notice letter for one sub on one awarded estimate. */
export function buildSubAwardNotice(
  estimate: Pick<PricedEstimate, 'projectName' | 'ownerAgency' | 'location'>,
  sub: SubBid,
  options: SubAwardNoticeOptions = {},
): SubAwardNotice {
  const company = options.company ?? YGE_COMPANY_INFO;
  const signer = options.signer ?? company.vicePresident;
  const date = options.date ?? todayLong();
  const window = options.responseWindowBusinessDays ?? 10;

  const agency = estimate.ownerAgency ?? 'the awarding agency';
  const locationLine =
    estimate.location && estimate.location.trim().length > 0
      ? ` (${estimate.location})`
      : '';

  const subjectLine = `Notice of Subcontract Award — ${estimate.projectName}`;

  const addressLines = sub.address
    ? sub.address.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    : [];

  const addressee: SubAwardNoticeAddressee = {
    contractorName: sub.contractorName,
    addressLines,
    cslbLicense: sub.cslbLicense,
    dirRegistration: sub.dirRegistration,
  };

  const bodyParagraphs: string[] = [
    `${agency} has awarded ${company.legalName} the prime contract for ${estimate.projectName}${locationLine}. You were the subcontractor we listed on the bid for the scope shown below, and this letter confirms the award of that scope to your firm at the price we listed.`,
    `Your bid is binding under California Public Contract Code §4104, and our award of this scope to you is binding on us. The formal subcontract follows; this notice locks in the listing while legal finalizes the paperwork.`,
  ];

  const scopeBlock: SubAwardNoticeScopeBlock = {
    portionOfWork: sub.portionOfWork,
    bidAmountUsd: formatUSD(sub.bidAmountCents),
  };

  const nextSteps: string[] = [
    'Certificate of insurance naming Young General Engineering, Inc. as additional insured.',
    'Current CSLB license certificate and DIR public-works contractor registration.',
    'Signed W-9 and a copy of your prevailing-wage compliance plan (if the project is PW-covered).',
    `Countersigned copy of this notice returned to ${signer.email} within ${window} business days.`,
  ];

  const closingParagraph =
    `If we don't hear back within ${window} business days we'll proceed under PCC §4107 to request agency consent for substitution. We expect that won't be necessary — you bid the work, you're awarded the work, and we're looking forward to building it with you. Call ${signer.phone} or email ${signer.email} with any questions.`;

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
    addressee,
    salutation: `Dear ${sub.contractorName} team,`,
    bodyParagraphs,
    scopeBlock,
    nextSteps,
    closingParagraph,
    closing: {
      line: 'Sincerely,',
      signer: {
        name: signer.name,
        title: signer.title,
        company: company.legalName,
        phone: signer.phone,
        email: signer.email,
      },
    },
    countersignaturePrompt:
      `Accepted and agreed on behalf of ${sub.contractorName}:`,
  };
}
