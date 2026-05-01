// RoleBadge — colored pill for an employee's role.
//
// Plain English: a tinted badge for roles like 'Foreman', 'Operator',
// 'Laborer'. Uses the StatusPill primitive for consistency.

import { StatusPill } from './status-pill';

interface Props {
  role: string;
  size?: 'sm' | 'md';
}

function roleLabel(role: string): string {
  switch (role) {
    case 'PRESIDENT': return 'President';
    case 'VP': return 'VP';
    case 'OFFICE': return 'Office';
    case 'SAFETY_DIRECTOR': return 'Safety Dir';
    case 'FOREMAN': return 'Foreman';
    case 'OPERATOR': return 'Operator';
    case 'DRIVER': return 'Driver';
    case 'LABORER': return 'Laborer';
    case 'APPRENTICE': return 'Apprentice';
    case 'CARPENTER': return 'Carpenter';
    case 'IRONWORKER': return 'Ironworker';
    case 'CEMENT_MASON': return 'Cement Mason';
    case 'OTHER': return 'Other';
    default: return role;
  }
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
