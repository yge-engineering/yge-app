// Subcontractor Notice to Proceed.
//
// Plain English: after a listed sub countersigns the §4104 award notice and
// the subcontract is fully executed, the prime sends a "Notice to Proceed"
// (NTP) telling the sub when to mobilize and who to report to on the first
// day. Without an NTP, a careful sub won't start — they don't want to
// arrive on day 1 and be turned away because the site isn't ready.
//
// NTP is short and operational: when, where, who, what scope. This module
// builds the structured letter; the web view + AP PDF generator render it.

import { YGE_COMPANY_INFO, formatCompanyAddressOneLine } from './company';
import type { CompanyContact, CompanyInfo } from './company';
import { formatUSD } from './money';
import type { PricedEstimate } from './priced-estimate';
import type { SubBid } from './sub-bid';

export interface SubNoticeToProceedFieldContact {
  /** Person on site the sub reports to (foreman / superintendent). */
  name: string;
  phone: string;
  /** Optional title — e.g. "YGE Foreman" or "Project Superintendent". */
  title?: string;
}

export interface SubNoticeToProceedOptions {
  /** Date that prints at the top. Defaults to today in en-US long form. */
  date?: string;
  /** Who signs. Defaults to the company VP (Ryan). */
  signer?: CompanyContact;
  /** Override the company info block. Defaults to YGE_COMPANY_INFO. */
  company?: CompanyInfo;
  /** ISO date or human-readable string — when the sub can start. */
  mobilizationStartDate: string;
  /** Site address or staging area where the sub should report.
   *  Free-form, printed verbatim. */
  reportToAddress?: string;
  /** Whom the sub should check in with on arrival. */
  fieldContact?: SubNoticeToProceedFieldContact;
  /** Bullet points reminding the sub of their listed scope, schedule,
   *  or PW compliance obligations. Empty array = no reminders block. */
  scopeReminderBullets?: readonly string[];
  /** Optional override of the daily start time. Defaults to "7:00 AM". */
  dailyStartTime?: string;
}

export interface SubNoticeToProceed {
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
    contractorName: string;
    addressLines: string[];
    cslbLicense?: string;
    dirRegistration?: string;
  };
  salutation: string;
  bodyParagraphs: string[];
  scopeBlock: {
    portionOfWork: string;
    bidAmountUsd: string;
  };
  mobilizationBlock: {
    startDate: string;
    dailyStartTime: string;
    reportToAddress?: string;
    fieldContact?: SubNoticeToProceedFieldContact;
  };
  scopeReminderBullets: string[];
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

/** Build the Notice to Proceed letter for one listed sub on one job. */
export function buildSubNoticeToProceed(
  estimate: Pick<PricedEstimate, 'projectName' | 'ownerAgency' | 'location'>,
  sub: SubBid,
  options: SubNoticeToProceedOptions,
): SubNoticeToProceed {
  const company = options.company ?? YGE_COMPANY_INFO;
  const signer = options.signer ?? company.vicePresident;
  const date = options.date ?? todayLong();
  const dailyStartTime = options.dailyStartTime ?? '7:00 AM';

  const agency = estimate.ownerAgency ?? 'the awarding agency';
  const locationLine =
    estimate.location && estimate.location.trim().length > 0
      ? ` (${estimate.location})`
      : '';

  const subjectLine = `Notice to Proceed — ${estimate.projectName}`;

  const addressee = {
    contractorName: sub.contractorName,
    addressLines: splitAddress(sub.address),
    cslbLicense: sub.cslbLicense,
    dirRegistration: sub.dirRegistration,
  };

  const bodyParagraphs: string[] = [
    `Thank you for the executed subcontract on ${estimate.projectName}${locationLine}, our prime contract with ${agency}. With paperwork in hand we are clearing you to mobilize on the scope and amount shown below.`,
    `This Notice to Proceed authorizes you to begin work on ${options.mobilizationStartDate}. Please check in with the field contact on arrival; any change to the mobilization date or location will come in writing from this office.`,
  ];

  const scopeReminderBullets = (options.scopeReminderBullets ?? []).filter(
    (s) => s.trim().length > 0,
  );

  const closingParagraph =
    `If anything blocks your start — material lead time, crew availability, agency-side delay — call ${signer.phone} or email ${signer.email} as soon as you know. We would rather adjust the schedule together than discover the gap on the first day.`;

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
    scopeBlock: {
      portionOfWork: sub.portionOfWork,
      bidAmountUsd: formatUSD(sub.bidAmountCents),
    },
    mobilizationBlock: {
      startDate: options.mobilizationStartDate,
      dailyStartTime,
      reportToAddress: options.reportToAddress?.trim() || undefined,
      fieldContact: options.fieldContact,
    },
    scopeReminderBullets: [...scopeReminderBullets],
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
  };
}
