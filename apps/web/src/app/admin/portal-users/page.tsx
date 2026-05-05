// /admin/portal-users — list everyone with login access + invite + revoke.
//
// Plain English: "who can sign into YGE?" page. Shows every portal
// user with their role, when they last signed in, whether they've
// set a password yet. Invite form at the bottom adds a new user; the
// row's role dropdown saves on change; the trash icon revokes.
// Shielded behind portalUsers:manage so foremen / crew never reach it.

import { notFound } from 'next/navigation';
import {
  AppShell,
  PageHeader,
} from '../../../components';
import { PortalUsersClient } from './portal-users-client';
import { getCurrentUser } from '../../../lib/auth';
import {
  ROLE_PERMISSIONS,
  type Employee,
  type Job,
  type PortalRole,
  type PortalUser,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchUsers(): Promise<PortalUser[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/portal-users`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { users?: PortalUser[] };
    return json.users ?? [];
  } catch {
    return [];
  }
}

async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = (await res.json()) as { jobs?: Job[] };
    return json.jobs ?? [];
  } catch {
    return [];
  }
}

async function fetchEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/employees`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { employees?: Employee[] };
    return json.employees ?? [];
  } catch {
    return [];
  }
}

export default async function PortalUsersAdminPage() {
  const me = getCurrentUser();
  // Server-side gate: only PRESIDENT / VP can manage portal users.
  // Map the existing legacy YgeUser.role to the portal-role enum
  // (they share the same string values — coercion is safe).
  const myRole = (me?.role as PortalRole | undefined) ?? null;
  const canManage =
    myRole !== null &&
    (ROLE_PERMISSIONS[myRole] ?? []).includes('portalUsers:manage');
  if (!canManage) notFound();

  const [users, jobs, employees] = await Promise.all([
    fetchUsers(),
    fetchJobs(),
    fetchEmployees(),
  ]);

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Portal users"
          subtitle="Everyone who can sign in to YGE. Invite new users, change roles, revoke access. Assign jobs to foremen so they only see their own. Link to their employee record so timecard + payroll connect."
        />
        <PortalUsersClient
          initialUsers={users}
          jobs={jobs}
          employees={employees}
          apiBaseUrl={publicApiBaseUrl()}
        />
      </main>
    </AppShell>
  );
}
