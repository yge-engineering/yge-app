// Portal permission system.
//
// Plain English: every signed-in user has a portal role (PRESIDENT,
// VP, OFFICE, FOREMAN, CREW). Each role unlocks a set of capability
// permissions — "view financial pages", "edit crew schedule", "see
// estimating dollars", etc. Pages and nav items check those caps
// before rendering. Foremen don't see estimating; crew doesn't see
// AP. Brook + Ryan see everything.
//
// Adding a new permission?
//   1. Add it to the Permission type below.
//   2. Wire it into ROLE_PERMISSIONS for each role that should have it.
//   3. Use userCan(user, 'thePerm') at the top of the page or in the
//      sidebar entry's `requires` field.

export type PortalRole =
  | 'PRESIDENT'
  | 'VP'
  | 'OFFICE'
  | 'PROJECT_MANAGER'
  | 'FOREMAN'
  | 'CREW';

export type Permission =
  // Estimating
  | 'estimates:view'
  | 'estimates:edit'
  // Financials — AP/AR/aging/cash/COA/journal/balance/income/payroll
  | 'financials:view'
  | 'financials:edit'
  // Jobs — list / detail
  | 'jobs:viewAll'
  | 'jobs:viewAssigned'
  | 'jobs:edit'
  // Field operations — daily reports, dispatch, time cards
  | 'field:view'
  | 'field:editAssigned'
  // Crew — roster + schedule
  | 'crew:view'
  | 'crew:edit'
  // Safety docs — IIPP, toolbox talks, incident reports, etc.
  | 'safety:view'
  | 'safety:edit'
  // Employees — HR-grade roster, fire/delete
  | 'employees:viewAll'
  | 'employees:editAll'
  // Master profile (CSLB, DIR, DOT, officers, insurance, banking)
  | 'masterProfile:view'
  | 'masterProfile:edit'
  // Audit log
  | 'audit:view'
  // Portal admin — invite/remove users, change roles
  | 'portalUsers:manage'
  // Settings + integrations (Microsoft 365, etc.)
  | 'settings:manage';

const ALL_PERMISSIONS: Permission[] = [
  'estimates:view',
  'estimates:edit',
  'financials:view',
  'financials:edit',
  'jobs:viewAll',
  'jobs:viewAssigned',
  'jobs:edit',
  'field:view',
  'field:editAssigned',
  'crew:view',
  'crew:edit',
  'safety:view',
  'safety:edit',
  'employees:viewAll',
  'employees:editAll',
  'masterProfile:view',
  'masterProfile:edit',
  'audit:view',
  'portalUsers:manage',
  'settings:manage',
];

export const ROLE_PERMISSIONS: Record<PortalRole, Permission[]> = {
  // Owners — everything.
  PRESIDENT: [...ALL_PERMISSIONS],
  VP: [...ALL_PERMISSIONS],

  // Office — finance + operations + employees, but not portal admin
  // (Brook/Ryan keep that lever).
  OFFICE: [
    'estimates:view',
    'estimates:edit',
    'financials:view',
    'financials:edit',
    'jobs:viewAll',
    'jobs:edit',
    'field:view',
    'crew:view',
    'crew:edit',
    'safety:view',
    'safety:edit',
    'employees:viewAll',
    'employees:editAll',
    'masterProfile:view',
    'masterProfile:edit',
    'audit:view',
  ],

  // PM — sees jobs + estimates + safety + crew, can't change financials.
  PROJECT_MANAGER: [
    'estimates:view',
    'jobs:viewAll',
    'jobs:edit',
    'field:view',
    'field:editAssigned',
    'crew:view',
    'crew:edit',
    'safety:view',
    'safety:edit',
    'employees:viewAll',
    'masterProfile:view',
  ],

  // Foreman — only their assigned jobs, no estimating dollars, no AP/AR.
  // Crew schedule for their crew, plus safety docs.
  FOREMAN: [
    'jobs:viewAssigned',
    'field:view',
    'field:editAssigned',
    'crew:view',
    'crew:edit',
    'safety:view',
  ],

  // Crew — own profile, own time card, safety docs only.
  CREW: ['safety:view'],
};

interface PortalUserShape {
  role: PortalRole;
  /** Optional list of jobIds this user can see when their role is
   *  jobs:viewAssigned (foreman). Empty / undefined = no jobs visible. */
  assignedJobIds?: string[];
}

/** Returns true if the user's role grants the named permission.
 *  Anonymous (null) users have no permissions. */
export function userCan(
  user: PortalUserShape | null | undefined,
  perm: Permission,
): boolean {
  if (!user) return false;
  const grants = ROLE_PERMISSIONS[user.role];
  if (!grants) return false;
  return grants.includes(perm);
}

/** Convenience: any of these perms is enough. Use when a page is
 *  visible if the user has either viewAll OR viewAssigned. */
export function userCanAny(
  user: PortalUserShape | null | undefined,
  perms: Permission[],
): boolean {
  return perms.some((p) => userCan(user, p));
}

/** Returns true if the user can see this jobId. ADMIN/OFFICE/PM with
 *  jobs:viewAll see everything; foremen see only assignedJobIds. */
export function userCanSeeJob(
  user: PortalUserShape | null | undefined,
  jobId: string,
): boolean {
  if (!user) return false;
  if (userCan(user, 'jobs:viewAll')) return true;
  if (userCan(user, 'jobs:viewAssigned')) {
    return (user.assignedJobIds ?? []).includes(jobId);
  }
  return false;
}

/** Display label for a role — used on /admin/portal-users. */
export function portalRoleLabel(r: PortalRole): string {
  switch (r) {
    case 'PRESIDENT':
      return 'President';
    case 'VP':
      return 'Vice President';
    case 'OFFICE':
      return 'Office staff';
    case 'PROJECT_MANAGER':
      return 'Project Manager';
    case 'FOREMAN':
      return 'Foreman';
    case 'CREW':
      return 'Crew member';
  }
}
