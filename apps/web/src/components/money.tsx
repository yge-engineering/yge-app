// Money — cents → USD display with consistent formatting.
//
// Plain English: pass a number in cents, get $1,234.56 back. Negative
// values render in red and parenthesized (accounting style). Optional
// 'compact' for big rolled-up numbers ($1.2M instead of $1,200,000.00).

interface Props {
  cents: number;
  /** Show the value with cents (default true). False rounds to whole dollars. */
  decimals?: boolean;
  /** Use accounting-style negative parentheses + red color (default true). */
  highlightNegative?: boolean;
  /** Render '$1.2M' / '$45.6K' for big numbers (default false). */
  compact?: boolean;
  /** Optional CSS class. */
  className?: string;
}

function formatCents(cents: number, opts: { decimals: boolean; compact: boolean }): string {
  const dollars = cents / 100;
  if (opts.compact && Math.abs(dollars) >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1)}M`;
  }
  if (opts.compact && Math.abs(dollars) >= 1_000) {
    return `$${(dollars / 1_000).toFixed(1)}K`;
  }
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  });
}

export function Money({
  cents,
  decimals = true,
  highlightNegative = true,
  compact = false,
  className,
}: Props) {
  const isNeg = cents < 0;
  const formatted = formatCents(Math.abs(cents), { decimals, compact });
  if (!highlightNegative) {
    return <span className={`whitespace-nowrap font-mono ${className ?? ''}`}>{isNeg ? `-${formatted}` : formatted}</span>;
  }
  if (isNeg) {
    return (
      <span className={`whitespace-nowrap font-mono text-red-700 ${className ?? ''}`}>
        ({formatted})
      </span>
    );
  }
  return (
    <span className={`whitespace-nowrap font-mono text-gray-900 ${className ?? ''}`}>{formatted}</span>
  );
}
