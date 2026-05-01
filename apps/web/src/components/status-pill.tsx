// StatusPill — colored badge for status enums.
//
// Plain English: every list page renders status badges. Centralize the
// color rules so 'OPEN' is the same yellow on /punch-lists, /rfis, and
// /jobs. Tone names (success, warn, danger, info, neutral, muted) keep
// callers from passing raw color hexes.

interface Props {
  label: string;
  tone?: 'success' | 'warn' | 'danger' | 'info' | 'neutral' | 'muted';
  size?: 'sm' | 'md';
}

const TONE_CLASSES: Record<NonNullable<Props['tone']>, string> = {
  success: 'bg-green-100 text-green-800',
  warn: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800',
  muted: 'bg-gray-100 text-gray-500',
};

export function StatusPill({ label, tone = 'neutral', size = 'md' }: Props) {
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}

/** Convenience: convert common job statuses to a tone. */
export function jobStatusTone(status: string): NonNullable<Props['tone']> {
  switch (status) {
    case 'AWARDED': return 'success';
    case 'PURSUING': return 'warn';
    case 'BID_SUBMITTED': return 'info';
    case 'LOST': return 'danger';
    case 'ARCHIVED': return 'muted';
    case 'NO_BID': return 'muted';
    case 'PROSPECT':
    default: return 'neutral';
  }
}

/** Convenience: tones for invoice / payment / RFI workflow statuses. */
export function workflowStatusTone(status: string): NonNullable<Props['tone']> {
  switch (status) {
    case 'PAID': case 'CLOSED': case 'APPROVED': case 'EXECUTED': case 'DELIVERED':
      return 'success';
    case 'PARTIALLY_PAID': case 'SUBMITTED': case 'PENDING': case 'IN_PROGRESS':
      return 'warn';
    case 'WRITTEN_OFF': case 'REJECTED': case 'DISPUTED': case 'WITHDRAWN':
      return 'danger';
    case 'SENT': case 'ANSWERED':
      return 'info';
    case 'DRAFT':
    default:
      return 'neutral';
  }
}
