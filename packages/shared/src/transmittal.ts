// Bid transmittal / cover letter builder.
//
// Every public-works bid envelope needs a cover letter on the *outside* of
// the bid form: addressed to the agency clerk, naming the project, listing
// what's enclosed, and signed by an officer of the company. Without one,
// the bid still gets opened — but the bid reviewer can't tell at a glance
// whose envelope it is, and missing items in the package may not get
// flagged until they cause a rejection.
//
// Design: a pure function `buildTransmittal()` returns a structured letter
// (header, addressee, body paragraphs, enclosures list, signature block).
// The web view renders it on letterhead; later, AP/PDF generators can use
// the same structure for the printed envelope contents.

import { YGE_COMPANY_INFO, formatCompanyAddressOneLine } from './company';
import type { CompanyContact, CompanyInfo } from './company';
import type { PricedEstimate, PricedEstimateTotals } from './priced-estimate';
import { sortedAddenda, allAddendaAcknowledged } from './addendum';
import { formatUSD } from './money';

export interface TransmittalAddressee {
  /** Agency name. Defaults to estimate.ownerAgency. */
  agency?: string;
  /** Agency clerk / addressee line — e.g. "Office of the City Clerk".
   *  Free-form; printed verbatim. */
  attention?: string;
  /** Optional street/city block. Free-form so clerks who give us a P.O.
   *  box plus a physical address can have both. */
  addressLines?: string[];
}

export interface TransmittalOptions {
  /** Override the date that prints at the top. Defaults to "today" in en-US
   *  long form. Tests pin this to keep snapshots stable. */
  date?: string;
  /** Who signs. Defaults to the company VP (Ryan). */
  signer?: CompanyContact;
  /** Override the company info block. Defaults to YGE_COMPANY_INFO. */
  company?: CompanyInfo;
  /** Override addressee block. Defaults to estimate.ownerAgency. */
  addressee?: TransmittalAddressee;
  /** Add a free-form paragraph between the project intro and the
   *  enclosures list — useful for site-walk attendance, exception
   *  acknowledgments, or thanking the agency. */
  customNote?: string;
}

export interface TransmittalEnclosure {
  /** Short label that prints in the enclosures list (e.g. "Bid form"). */
  label: string;
  /** Optional one-line detail (e.g. "10% bid bond — $145,000"). */
  detail?: string;
}

export interface Transmittal {
  /** "April 24, 2026" or whatever the caller passes in. */
  date: string;
  /** Subject line — typically "RE: Bid for <projectName>". */
  subjectLine: string;
  /** Block at the top right of the letterhead (company name + address). */
  companyHeader: {
    legalName: string;
    addressLine: string;
    cslbLicense: string;
    dirNumber: string;
    phone: string;
    email: string;
  };
  /** Whom the letter is addressed to. */
  addressee: {
    agency: string;
    attention?: string;
    addressLines: string[];
  };
  salutation: string;
  /** Body paragraphs in order. The renderer prints one per <p>. */
  bodyParagraphs: string[];
  enclosures: TransmittalEnclosure[];
  /** Closing line ("Sincerely,") + signer block. */
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

/** Compute the enclosures list from an estimate. The order matches what an
 *  agency reviewer expects to see in the envelope: bid form first, then sub
 *  list, then security, then addenda acks, then license/DIR proofs. */
export function computeEnclosures(
  estimate: PricedEstimate,
  totals: PricedEstimateTotals,
  company: CompanyInfo,
): TransmittalEnclosure[] {
  const out: TransmittalEnclosure[] = [];

  out.push({
    label: 'Sealed bid form',
    detail: `Bid total ${formatUSD(totals.bidTotalCents)}`,
  });

  if (estimate.subBids.length > 0) {
    out.push({
      label: 'Designated subcontractor list (PCC \u00a74104)',
      detail: `${estimate.subBids.length} sub${estimate.subBids.length === 1 ? '' : 's'} listed`,
    });
  }

  if (estimate.bidSecurity) {
    const sec = estimate.bidSecurity;
    // Use a short human label for the security type without pulling the
    // bid-security helper module (avoids a circular import).
    const typeLabel =
      sec.type === 'BID_BOND'
        ? 'Bid bond'
        : sec.type === 'CASHIERS_CHECK'
          ? "Cashier's check"
          : sec.type === 'CERTIFIED_CHECK'
            ? 'Certified check'
            : 'Bid security';
    const detail =
      sec.type === 'BID_BOND' && sec.suretyName
        ? `${typeLabel} \u2014 ${sec.suretyName}`
        : typeLabel;
    out.push({ label: 'Bid security', detail });
  }

  const addenda = sortedAddenda(estimate.addenda);
  if (addenda.length > 0) {
    const acked = allAddendaAcknowledged(addenda);
    out.push({
      label: 'Addenda acknowledgments',
      detail: `${addenda.length} addend${addenda.length === 1 ? 'um' : 'a'}${
        acked ? ' \u2014 all acknowledged' : ' \u2014 SEE BID FORM'
      }`,
    });
  }

  out.push({
    label: 'Contractor\u2019s license certificate',
    detail: `CSLB #${company.cslbLicense}`,
  });
  out.push({
    label: 'DIR public works registration',
    detail: `DIR #${company.dirNumber}`,
  });

  return out;
}

/** Build a full transmittal letter from an estimate + its computed totals. */
export function buildTransmittal(
  estimate: PricedEstimate,
  totals: PricedEstimateTotals,
  options: TransmittalOptions = {},
): Transmittal {
  const company = options.company ?? YGE_COMPANY_INFO;
  const signer = options.signer ?? company.vicePresident;
  const date = options.date ?? todayLong();

  const agency =
    options.addressee?.agency ?? estimate.ownerAgency ?? '[Awarding Agency]';
  const addressLines = options.addressee?.addressLines ?? [];

  const subjectLine = `RE: Bid for ${estimate.projectName}`;

  // Body paragraphs — kept short and direct. Tone is professional, not
  // slick; agency clerks read these every day.
  const dueLine =
    estimate.bidDueDate && estimate.bidDueDate.trim().length > 0
      ? ` for the bid opening on ${estimate.bidDueDate}`
      : '';
  const locationLine =
    estimate.location && estimate.location.trim().length > 0
      ? ` (${estimate.location})`
      : '';

  const bodyParagraphs: string[] = [
    `Please find enclosed our sealed bid${dueLine} for ${estimate.projectName}${locationLine}. Our total bid is ${formatUSD(totals.bidTotalCents)}.`,
    `${company.legalName} is fully licensed and registered to perform this work in California (CSLB #${company.cslbLicense}, DIR #${company.dirNumber}). Our bid is valid for ${company.bidValidityDays} calendar days from the bid opening date.`,
  ];

  if (options.customNote && options.customNote.trim().length > 0) {
    bodyParagraphs.push(options.customNote.trim());
  }

  bodyParagraphs.push(
    'The following items are enclosed in our bid package:',
  );
  bodyParagraphs.push(
    'Please contact me directly with any questions. We appreciate the opportunity to bid this project.',
  );

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
      attention: options.addressee?.attention,
      addressLines,
    },
    salutation: options.addressee?.attention
      ? `Attention: ${options.addressee.attention},`
      : 'To Whom It May Concern,',
    bodyParagraphs,
    enclosures: computeEnclosures(estimate, totals, company),
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
  };
}
