// Money helpers.
//
// All amounts are stored as integer cents. These helpers convert to/from
// the display-friendly dollar representation and format for UI.

export type Cents = number;

export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: Cents): number {
  return cents / 100;
}

export function formatUSD(cents: Cents, options?: { compact?: boolean }): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: options?.compact ? 0 : 2,
    maximumFractionDigits: options?.compact ? 0 : 2,
  });
  return formatter.format(cents / 100);
}

/** Add a percentage markup to a cents amount, returning a whole-cent result. */
export function addMarkup(cents: Cents, pct: number): Cents {
  return Math.round(cents * (1 + pct));
}

/** Extract the markup portion from a base cents and pct, without the base. */
export function markupAmount(cents: Cents, pct: number): Cents {
  return Math.round(cents * pct);
}
