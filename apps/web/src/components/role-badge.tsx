'use client';

// RoleBadge — colored pill for an employee's role.
//
// Plain English: a tinted badge for roles like 'Foreman', 'Operator',
// 'Laborer'. Uses the StatusPill primitive for consistency.
//
// Client component so it can be re-exported through the components
// barrel without dragging `next/headers` into client bundles.

import { StatusPill } from './status-pill';
import { useTranslator, type Translator } from '../lib/use-translator';

interface Props {
  role: string;
  size?: 'sm' | 'md';
}

const ROLE_KEYS = new Set([
  'PRESIDENT', 'VP', 'OFFICE', 'SAFETY_DIRECTOR', 'FOREMAN', 'OPERATOR',
  'DRIVER', 'LABORER', 'APPRENTICE', 'CARPENTER', 'IRONWORKER',
  'CEMENT_MASON', 'OTHER',
]);

function roleLabel(role: string, t: Translator): string {
  if (!ROLE_KEYS.has(role)) return role;
  return t(`role.${role}`);
}

function roleTone(role: string): 'success' | 'warn' | 'info' | 'neutral' | 'muted' {
  switch (role) {
    case 'PRESIDENT':
    case 'VP':
      return 'info';
    case 'FOREMAN':
    case 'SAFETY_DIRECTOR':
      return 'success';
    case 'OFFICE':
      return 'neutral';
    case 'APPRENTICE':
      return 'warn';
    default:
      return 'neutral';
  }
}

export function RoleBadge({ role, size = 'sm' }: Props) {
  const t = useTranslator();
  return <StatusPill label={roleLabel(role, t)} tone={roleTone(role)} size={size} />;
}
