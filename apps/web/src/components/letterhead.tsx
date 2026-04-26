// Letterhead — the YGE branded header block used on every printable page.
//
// Two variants:
//   <Letterhead variant="full" />       full-width header with logo + address
//                                       block, suitable for cover letter
//                                       and bid summary.
//   <Letterhead variant="compact" />    smaller header for the envelope
//                                       checklist + crew roster, where the
//                                       page already has its own subject
//                                       header below.
//
// Address + license numbers come from YGE_COMPANY_INFO (single source of
// truth). When the company info changes (new license number, address
// update), every printable updates automatically.

import {
  YGE_COMPANY_INFO,
  formatCompanyAddressOneLine,
  type CompanyInfo,
} from '@yge/shared';

interface Props {
  /** Override the company block — used when a future tenant feature lands. */
  company?: CompanyInfo;
  /** Layout variant. 'compact' fits the envelope checklist + crew roster
   *  where space is tight; 'full' is the cover-letter / bid-summary look. */
  variant?: 'full' | 'compact';
  /** Optional right-side block. Pass things like a date + page-purpose
   *  badge to override the default address-on-the-right rendering. */
  rightBlock?: React.ReactNode;
}

export function Letterhead({
  company = YGE_COMPANY_INFO,
  variant = 'full',
  rightBlock,
}: Props) {
  if (variant === 'compact') {
    return (
      <header className="border-b-2 border-yge-blue-500 pb-3">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/yge-logo.svg"
              alt={`${company.shortName} logo`}
              className="h-12 w-12"
            />
            <div>
              <div className="text-lg font-bold text-yge-blue-700 leading-tight">
                {company.legalName}
              </div>
              <div className="text-xs text-gray-600">
                CSLB #{company.cslbLicense} &middot; DIR #{company.dirNumber}
              </div>
            </div>
          </div>
          {rightBlock && <div className="text-right text-xs">{rightBlock}</div>}
        </div>
      </header>
    );
  }

  // Full variant — used by cover letter + bid summary.
  return (
    <header className="border-b-2 border-yge-blue-500 pb-4">
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/yge-logo.svg"
            alt={`${company.shortName} logo`}
            className="h-20 w-20"
          />
          <div>
            <h1 className="text-2xl font-bold text-yge-blue-700 leading-tight">
              {company.legalName}
            </h1>
            <p className="text-sm font-medium text-yge-accent-500">
              {company.tagline}
            </p>
          </div>
        </div>
        <address className="text-right text-xs not-italic text-gray-700">
          {rightBlock ?? (
            <>
              {formatCompanyAddressOneLine(company)}
              <br />
              <br />
              CSLB #{company.cslbLicense}
              <br />
              DIR #{company.dirNumber}
              <br />
              {company.president.phone}
              <br />
              {company.president.email}
            </>
          )}
        </address>
      </div>
    </header>
  );
}
