// Spinner — inline loading indicator.
//
// Plain English: a small animated circle for inline 'loading…' states
// inside cards / buttons. The full-page loading.tsx is for route
// transitions; this is for inline async work.

interface Props {
  /** Tailwind size class (default 'h-4 w-4'). */
  size?: 'sm' | 'md' | 'lg';
  /** Color class — defaults to currentColor (inherits from parent). */
  className?: string;
  /** Accessible label. */
  label?: string;
}

const SIZE_CLASS: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-3 w-3 border-[2px]',
  md: 'h-4 w-4 border-2',
  lg: 'h-6 w-6 border-[3px]',
};

export function Spinner({ size = 'md', className, label = 'Loading' }: Props) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-current border-t-transparent ${SIZE_CLASS[size]} ${className ?? ''}`}
    />
  );
}
