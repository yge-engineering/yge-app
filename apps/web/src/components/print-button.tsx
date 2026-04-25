'use client';

// Tiny client island so /estimates/[id]/print can stay a server component
// (it does its own data fetch). The print button is the only interactive
// element on that page.

interface Props {
  className?: string;
  label?: string;
}

export function PrintButton({ className, label = 'Print / Save as PDF' }: Props) {
  return (
    <button
      onClick={() => window.print()}
      className={
        className ??
        'rounded bg-yge-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-yge-blue-700'
      }
    >
      {label}
    </button>
  );
}
