// BidTotalsCopyCard — small card of click-to-copy values for
// pasting into the agency's web bid form on bid day.
//
// Each row has a human-readable label and a copy button that
// drops a clean string on the clipboard:
//   - Bid total (no $, no commas, no decimals): "1234567"
//   - Bid total (whole dollars only): "1234567"
//   - Bid security amount (when configured)
//   - Project name (verbatim)
//
// Server component shell; CopyableValue is the client island
// underneath each row.

import { CopyableValue } from './copyable-value';
import {
  bidSecurityAmountCents,
  formatUSD,
  type PricedEstimate,
  type PricedEstimateTotals,
} from '@yge/shared';

interface Props {
  estimate: PricedEstimate;
  totals: PricedEstimateTotals;
}

function centsToWholeDollarsString(cents: number): string {
  // Whole dollars only — round half-up.
  return Math.round(cents / 100).toString();
}

function centsToDollarsAndCentsString(cents: number): string {
  // "1234567.89" — no commas, no $ sign, two decimals.
  const dollars = Math.floor(cents / 100);
  const remainder = Math.abs(cents % 100).toString().padStart(2, '0');
  return `${dollars}.${remainder}`;
}

export function BidTotalsCopyCard({ estimate, totals }: Props) {
  const bidSecurity = estimate.bidSecurity
    ? bidSecurityAmountCents(totals.bidTotalCents, estimate.bidSecurity)
    : null;

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Quick-copy
      </h3>
      <p className="mt-1 text-[11px] text-gray-500">
        For pasting into the agency&apos;s web bid form.
      </p>
      <div className="mt-3 divide-y divide-gray-100">
        <div className="py-2">
          <CopyableValue
            caption="Bid total (dollars + cents)"
            label={formatUSD(totals.bidTotalCents)}
            clipboard={centsToDollarsAndCentsString(totals.bidTotalCents)}
            copyTitle="Copy as 1234567.89"
          />
        </div>
        <div className="py-2">
          <CopyableValue
            caption="Bid total (whole dollars)"
            label={`$${centsToWholeDollarsString(totals.bidTotalCents)}`}
            clipboard={centsToWholeDollarsString(totals.bidTotalCents)}
            copyTitle="Copy as 1234567"
          />
        </div>
        {bidSecurity !== null && (
          <div className="py-2">
            <CopyableValue
              caption="Bid security amount"
              label={formatUSD(bidSecurity)}
              clipboard={centsToDollarsAndCentsString(bidSecurity)}
            />
          </div>
        )}
        <div className="py-2">
          <CopyableValue
            caption="Project name"
            label={estimate.projectName}
            clipboard={estimate.projectName}
          />
        </div>
        {estimate.ownerAgency && (
          <div className="py-2">
            <CopyableValue
              caption="Owner / agency"
              label={estimate.ownerAgency}
              clipboard={estimate.ownerAgency}
            />
          </div>
        )}
      </div>
    </section>
  );
}
