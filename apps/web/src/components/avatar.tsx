// Avatar — initials-in-a-circle for people in lists.
//
// Plain English: that little colored bubble with someone's initials
// next to their name. Crew lists, dispatch boards, daily reports,
// time cards — they all want this. Color is hashed from the name so
// "Brook Young" always renders the same color (visual recognition).

interface Props {
  /** Display name; "Brook Young" → "BY". Empty → "?". */
  name: string;
  /** Tailwind size — sm (24px), md (32px, default), lg (40px). */
  size?: 'sm' | 'md' | 'lg';
  /** Optional override class for the wrapper. */
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

// Eight muted tones; index chosen by name hash so a person always
// gets the same color. These are tailwind bg + text combos so the
// initials read well on the bubble.
const TONES = [
  'bg-blue-100 text-blue-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-violet-100 text-violet-800',
  'bg-rose-100 text-rose-800',
  'bg-cyan-100 text-cyan-800',
  'bg-orange-100 text-orange-800',
  'bg-teal-100 text-teal-800',
] as const;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}

export function Avatar({ name, size = 'md', className }: Props) {
  const tone = TONES[hash(name) % TONES.length];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${tone} ${SIZE_CLASS[size]} ${className ?? ''}`}
    >
      {initials(name)}
    </span>
  );
}
