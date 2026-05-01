// Button — consistent, themeable button + button-as-link.
//
// Plain English: every page hand-rolls button classNames today. This
// centralizes them so 'primary' is the same shade of blue everywhere
// and the disabled state is consistent.

import Link from 'next/link';
import type React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

interface ButtonProps extends CommonProps {
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** name + value for forms with multiple submit buttons. */
  name?: string;
  value?: string;
}

interface LinkButtonProps extends CommonProps {
  href: string;
  /** External link — adds target="_blank" + security rels. */
  external?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-blue-700 text-white hover:bg-blue-800 disabled:bg-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700',
  secondary:
    'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700',
  danger:
    'bg-red-700 text-white hover:bg-red-800 disabled:bg-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700',
  ghost:
    'bg-transparent text-gray-700 hover:bg-gray-100 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'rounded-md px-2.5 py-1 text-xs font-medium',
  md: 'rounded-md px-3 py-1.5 text-sm font-medium',
  lg: 'rounded-md px-4 py-2 text-sm font-semibold',
};

function classes({ variant = 'primary', size = 'md' }: { variant?: Variant; size?: Size }, extra?: string) {
  return `inline-flex items-center justify-center gap-1.5 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${extra ?? ''}`;
}

export function Button({ children, variant, size, type = 'button', disabled, onClick, name, value, className }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      name={name}
      value={value}
      className={classes({ variant, size }, className)}
    >
      {children}
    </button>
  );
}

export function LinkButton({ children, href, variant, size, external, className }: LinkButtonProps) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes({ variant, size }, className)}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes({ variant, size }, className)}>
      {children}
    </Link>
  );
}
