// Server-side permission helper.
//
// Plain English: pages that should only show to certain roles call
// requirePermission('financials:view') (or whatever cap they need)
// at the top. If the current user doesn't have it, they get
// redirected to /dashboard. The shared @yge/shared/permissions
// module owns the role → cap matrix; this is just the binding to
// the YgeUser cookie.

import { redirect } from 'next/navigation';
import { ROLE_PERMISSIONS, type Permission } from '@yge/shared';

import { getCurrentUser } from './auth';

/** Returns true if the signed-in user has the named permission.
 *  Anonymous → false. */
export function currentUserCan(perm: Permission): boolean {
  const u = getCurrentUser();
  if (!u) return false;
  return (ROLE_PERMISSIONS[u.role] ?? []).includes(perm);
}

/** Server-side gate — call at the top of a protected page.
 *  Redirects unauthenticated users to /login and signed-in users
 *  who lack the permission to /dashboard. */
export function requirePermission(perm: Permission): void {
  const u = getCurrentUser();
  if (!u) redirect('/login');
  const grants = ROLE_PERMISSIONS[u.role] ?? [];
  if (!grants.includes(perm)) redirect('/dashboard');
}

/** Pass-any variant — page is visible if the user has any of the
 *  listed permissions. Useful for pages like /jobs that show the
 *  full list to admins/office and only assigned jobs to foremen. */
export function requireAnyPermission(perms: Permission[]): void {
  const u = getCurrentUser();
  if (!u) redirect('/login');
  const grants = ROLE_PERMISSIONS[u.role] ?? [];
  if (!perms.some((p) => grants.includes(p))) redirect('/dashboard');
}
