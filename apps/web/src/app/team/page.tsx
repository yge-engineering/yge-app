// /team — list of users with sign-in access.
//
// Plain English: who can log in, what role each one has, contact
// info. Different from /employees (which is the full crew roster
// for dispatch + payroll). /team is just the people who have an
// account.

import {
  AppShell,
  Avatar,
  Card,
  DataTable,
  PageHeader,
  RoleBadge,
} from '../../components';
import { isSupabaseConfigured } from '../../lib/auth';

interface TeamMember {
  id: string; // = email, satisfies DataTable's keyFn
  email: string;
  name: string;
  role: 'PRESIDENT' | 'VP' | 'OFFICE' | 'FOREMAN' | 'CREW';
  phone?: string;
}

// Hard-coded for now — sourced from lib/auth.ts SEEDED_USERS plus the
// company contact info. When Supabase Auth lands, this will pull from
// auth.users + a profile join.
const TEAM: TeamMember[] = [
  { id: 'brookyoung@youngge.com', email: 'brookyoung@youngge.com', name: 'Brook L Young', role: 'PRESIDENT', phone: '707-499-7065' },
  { id: 'ryoung@youngge.com', email: 'ryoung@youngge.com', name: 'Ryan D Young', role: 'VP', phone: '707-599-9921' },
];

export default function TeamPage() {
  const supabaseLive = isSupabaseConfigured();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="Team"
          subtitle={
            supabaseLive
              ? 'Everyone with sign-in access. Source: Supabase Auth.'
              : 'Everyone with sign-in access. Source: dev-mode email allowlist (lib/auth.ts).'
          }
        />

        {!supabaseLive ? (
          <Card className="mb-4 border-amber-300 bg-amber-50">
            <p className="text-sm text-amber-900">
              <strong>Dev mode.</strong> Adding a new team member today means editing{' '}
              <code className="rounded bg-amber-100 px-1 font-mono text-xs">apps/web/src/lib/auth.ts</code>{' '}
              and shipping a commit. When Supabase Auth lands, this becomes a UI flow.
            </p>
          </Card>
        ) : null}

        <DataTable
          rows={TEAM}
          keyFn={(t) => t.email}
          columns={[
            {
              key: 'name',
              header: 'Name',
              cell: (t) => (
                <span className="flex items-center gap-2">
                  <Avatar name={t.name} size="sm" />
                  <span className="font-medium text-gray-900">{t.name}</span>
                </span>
              ),
            },
            { key: 'role', header: 'Role', cell: (t) => <RoleBadge role={t.role} size="md" /> },
            { key: 'email', header: 'Email', cell: (t) => <span className="font-mono text-xs text-gray-700">{t.email}</span> },
            { key: 'phone', header: 'Phone', cell: (t) => t.phone ?? <span className="text-gray-400">—</span> },
          ]}
        />
      </main>
    </AppShell>
  );
}
