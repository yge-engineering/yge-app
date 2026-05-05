// /admin — index of admin-only tools.
//
// Plain English: a one-stop landing for the admin pages so Brook +
// Ryan don't have to remember all the URLs. Filters tiles by the
// signed-in user's permissions — owners see everything, office sees
// the data tools, foremen + crew get redirected to /dashboard.

import Link from 'next/link';

import { AppShell, Card, PageHeader } from '../../components';
import { getCurrentUser } from '../../lib/auth';
import { ROLE_PERMISSIONS, type Permission } from '@yge/shared';
import { redirect } from 'next/navigation';

interface Tile {
  href: string;
  title: string;
  blurb: string;
  requires: Permission;
}

const TILES: Tile[] = [
  {
    href: '/admin/portal-users',
    title: 'Portal users',
    blurb: 'Invite users, change roles, assign foremen to jobs, reset passwords.',
    requires: 'portalUsers:manage',
  },
  {
    href: '/master-profile',
    title: 'Master profile',
    blurb: 'CSLB / DIR / DOT / officers / insurance / banking — printed on every form.',
    requires: 'masterProfile:view',
  },
  {
    href: '/audit',
    title: 'Audit log',
    blurb: 'Every mutation across the company — who, what, when, before/after.',
    requires: 'audit:view',
  },
  {
    href: '/admin/p2e-accuracy',
    title: 'Plans-to-Estimate accuracy',
    blurb: 'Reviewer verdicts on AI drafts. Tracks Good / Mixed / Bad over time.',
    requires: 'audit:view',
  },
  {
    href: '/settings',
    title: 'Settings',
    blurb: 'Locale, integrations, app preferences.',
    requires: 'settings:manage',
  },
];

export default function AdminIndexPage() {
  const user = getCurrentUser();
  const grants = user ? (ROLE_PERMISSIONS[user.role] ?? []) : [];
  const visible = TILES.filter((t) => grants.includes(t.requires));
  if (visible.length === 0) {
    redirect('/dashboard');
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="Admin"
          subtitle="Owner + office tooling. Pages filtered by your role."
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group block"
            >
              <Card className="transition group-hover:border-blue-700 group-hover:bg-blue-50">
                <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-800">
                  {t.title} →
                </h2>
                <p className="mt-1 text-sm text-gray-600">{t.blurb}</p>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
