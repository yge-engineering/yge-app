// /team — list of users with sign-in access.
//
// Plain English: who can log in, what role each one has, contact
// info. Different from /employees (which is the full crew roster
// for dispatch + payroll). /team is just the people who have an
// account.

import {
  Alert,
  AppShell,
  Avatar,
  DataTable,
  PageHeader,
  RoleBadge,
} from '../../components';
import { isSupabaseConfigured } from '../../lib/auth';
import { getTranslator } from '../../lib/locale';

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
  const t = getTranslator();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title={t('team.title')}
          subtitle={supabaseLive ? t('team.subtitleSupabase') : t('team.subtitleDev')}
        />

        {!supabaseLive ? (
          <Alert tone="warn" title={t('team.devAlert.title')} className="mb-4">
            {t('team.devAlert.body')}
          </Alert>
        ) : null}

        <DataTable
          rows={TEAM}
          keyFn={(member) => member.email}
          columns={[
            {
              key: 'name',
              header: t('team.col.name'),
              cell: (member) => (
                <span className="flex items-center gap-2">
                  <Avatar name={member.name} size="sm" />
                  <span className="font-medium text-gray-900">{member.name}</span>
                </span>
              ),
            },
            { key: 'role', header: t('team.col.role'), cell: (member) => <RoleBadge role={member.role} size="md" /> },
            { key: 'email', header: t('team.col.email'), cell: (member) => <span className="font-mono text-xs text-gray-700">{member.email}</span> },
            { key: 'phone', header: t('team.col.phone'), cell: (member) => member.phone ?? <span className="text-gray-400">—</span> },
          ]}
        />
      </main>
    </AppShell>
  );
}
