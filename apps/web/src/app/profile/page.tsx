// /profile — signed-in user's account page.
//
// Plain English: shows who you are right now, what role the system
// thinks you have, and the company info that prints on every YGE
// document. Refactored to use the shared component library.

import Link from 'next/link';

import {
  ROLE_PERMISSIONS,
  type Job,
  type PortalUser,
} from '@yge/shared';

import {
  AppShell,
  Button,
  Card,
  ChangePasswordForm,
  DescriptionList,
  MyAssignedJobs,
  PageHeader,
  RoleBadge,
} from '../../components';
import { signOut } from '../login/actions';
import { getCurrentUser } from '../../lib/auth';
import { getTranslator } from '../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchMe(email: string): Promise<PortalUser | null> {
  if (!email) return null;
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/portal-users/by-email?email=${encodeURIComponent(email)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { user?: PortalUser };
    return j.user ?? null;
  } catch {
    return null;
  }
}

async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    const j = (await res.json()) as { jobs?: Job[] };
    return j.jobs ?? [];
  } catch {
    return [];
  }
}

export default async function ProfilePage() {
  const user = getCurrentUser();
  const t = getTranslator();
  if (!user) {
    return (
      <AppShell>
        <main className="mx-auto max-w-2xl px-6 py-12">
          <p className="text-sm text-gray-600">{t('profile.notSignedIn')}</p>
        </main>
      </AppShell>
    );
  }

  // Foremen see their assigned jobs on /profile so they can jump
  // straight to one without using the sidebar. Other roles get null
  // back from MyAssignedJobs.
  const [me, jobs] =
    user.role === 'FOREMAN'
      ? await Promise.all([fetchMe(user.email), fetchJobs()])
      : [null, []];

  // Admin shortcut visible to anyone with portalUsers:manage,
  // masterProfile:view, or audit:view. Saves Brook + Ryan a click
  // when they need to invite a user or check the audit log.
  const grants = ROLE_PERMISSIONS[user.role] ?? [];
  const showAdminShortcut =
    grants.includes('portalUsers:manage') ||
    grants.includes('masterProfile:view') ||
    grants.includes('audit:view');

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader
          title={t('profile.title')}
          subtitle={t('profile.subtitle')}
        />

        <Card className="mb-6">
          <DescriptionList
            items={[
              { label: t('profile.field.name'), value: user.name },
              { label: t('profile.field.email'), value: user.email },
              { label: t('profile.field.role'), value: <RoleBadge role={user.role} size="md" /> },
              { label: t('profile.field.signInMethod'), value: t('profile.signInMethodValue') },
            ]}
          />
          <div className="mt-5 border-t border-gray-100 pt-4">
            <form action={signOut}>
              <Button type="submit" variant="secondary" size="md">
                {t('profile.signOut')}
              </Button>
            </form>
          </div>
        </Card>

        {user.role === 'FOREMAN' && (
          <div className="mb-6">
            <MyAssignedJobs me={me} jobs={jobs} />
          </div>
        )}

        {showAdminShortcut && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>
                <strong className="block text-blue-900">Admin tools</strong>
                <span className="text-xs text-blue-800">
                  Portal users, master profile, audit log, settings.
                </span>
              </span>
              <Link
                href="/admin"
                className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Open admin →
              </Link>
            </div>
          </div>
        )}

        <div className="mb-6">
          <ChangePasswordForm
            email={user.email}
            apiBaseUrl={publicApiBaseUrl()}
          />
        </div>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('profile.companyInfo')}</h2>
          <p className="mb-3 text-xs text-gray-500">
            {(() => {
              // Split-and-fill: keep /brand as a real <Link/> while pulling
              // surrounding text from the localized template.
              const tpl = t('profile.companyInfo.note');
              const [pre, post] = tpl.split('/brand');
              return (
                <>
                  {pre}
                  <Link href="/brand" className="text-blue-700 hover:underline">/brand</Link>
                  {post}
                </>
              );
            })()}
          </p>
          <DescriptionList
            items={[
              { label: t('profile.field.legalName'), value: 'Young General Engineering, Inc' },
              { label: t('profile.field.address'), value: '19645 Little Woods Rd, Cottonwood CA 96022', full: true },
              { label: t('profile.field.cslb'), value: '1145219' },
              { label: t('profile.field.dir'), value: '2000018967' },
              { label: t('profile.field.dot'), value: '4528204' },
              { label: t('profile.field.naics'), value: '115310' },
              { label: t('profile.field.psc'), value: 'F003, F004' },
              { label: t('profile.field.president'), value: 'Brook L Young (707-499-7065)' },
              { label: t('profile.field.vp'), value: 'Ryan D Young (707-599-9921)' },
            ]}
          />
        </Card>
      </main>
    </AppShell>
  );
}
