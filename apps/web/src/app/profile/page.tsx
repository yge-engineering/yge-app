// /profile — signed-in user's account page.
//
// Plain English: shows who you are right now, what role the system
// thinks you have, and the company info that prints on every YGE
// document. Refactored to use the shared component library.

import Link from 'next/link';

import { AppShell, Button, Card, DescriptionList, PageHeader, RoleBadge } from '../../components';
import { signOut } from '../login/actions';
import { getCurrentUser } from '../../lib/auth';
import { getTranslator } from '../../lib/locale';

export default function ProfilePage() {
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
