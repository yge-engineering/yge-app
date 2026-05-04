// RoleBadge — colored pill for an employee's role.
//
// Plain English: a tinted badge for roles like 'Foreman', 'Operator',
// 'Laborer'. Uses the StatusPill primitive for consistency.

import { StatusPill } from './status-pill';
import { getTranslator } from '../lib/locale';

interface Props {
  role: string;
  size?: 'sm' | 'md';
}

const ROLE_KEYS = new Set([
  'PRESIDENT', 'VP', 'OFFICE', 'SAFETY_DIRECTOR', 'FOREMAN', 'OPERATOR',
  'DRIVER', 'LABORER', 'APPRENTICE', 'CARPENTER', 'IRONWORKER',
  'CEMENT_MASON', 'OTHER',
]);

function roleLabel(role: string): string {
  if (!ROLE_KEYS.has(role)) return role;
  const t = getTranslator();
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
  return <StatusPill label={roleLabel(role)} tone={roleTone(role)} size={size} />;
}
