// BidContactCopyCard — quick-copy values for YGE company
// identifiers (legal name, CSLB, DIR, DOT, address, phone) for
// pasting into agency portals that the browser extension can't
// auto-fill (Java applets, screen-captcha gated forms, paper-
// to-screen workflows).
//
// Pairs with BidTotalsCopyCard on bid-day cockpit — totals there,
// company identifiers here. Both use the CopyableValue client
// island.

import {
  YGE_COMPANY_INFO,
  formatCompanyAddressOneLine,
} from '@yge/shared';

import { CopyableValue } from './copyable-value';

export function BidContactCopyCard() {
  const c = YGE_COMPANY_INFO;
  const addressOneLine = formatCompanyAddressOneLine(c);

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Quick-copy company identifiers
      </h3>
      <p className="mt-1 text-[11px] text-gray-500">
        For agency portals where the extension can&apos;t auto-fill.
      </p>
      <div className="mt-3 space-y-2">
        <CopyableValue
          caption="Legal name"
          label={c.legalName}
          clipboard={c.legalName}
        />
        <CopyableValue
          caption="CSLB license"
          label={c.cslbLicense}
          clipboard={c.cslbLicense}
        />
        {c.cslbClassifications.length > 0 && (
          <CopyableValue
            caption="CSLB classifications"
            label={c.cslbClassifications.join(', ')}
            clipboard={c.cslbClassifications.join(', ')}
          />
        )}
        <CopyableValue
          caption="DIR registration"
          label={c.dirNumber}
          clipboard={c.dirNumber}
        />
        <CopyableValue
          caption="USDOT"
          label={c.dotNumber}
          clipboard={c.dotNumber}
        />
        {c.naicsCodes.length > 0 && (
          <CopyableValue
            caption="NAICS codes"
            label={c.naicsCodes.join(', ')}
            clipboard={c.naicsCodes.join(', ')}
          />
        )}
        {c.pscCodes.length > 0 && (
          <CopyableValue
            caption="PSC codes"
            label={c.pscCodes.join(', ')}
            clipboard={c.pscCodes.join(', ')}
          />
        )}
        <CopyableValue
          caption="Address (one line)"
          label={addressOneLine}
          clipboard={addressOneLine}
        />
        <CopyableValue
          caption="VP phone"
          label={c.vicePresident.phone}
          clipboard={c.vicePresident.phone}
        />
        <CopyableValue
          caption="VP email"
          label={c.vicePresident.email}
          clipboard={c.vicePresident.email}
        />
      </div>
    </section>
  );
}
