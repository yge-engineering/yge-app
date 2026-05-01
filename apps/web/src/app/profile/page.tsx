// /profile — signed-in user's account page.
//
// Plain English: shows who you are right now, what role the system
// thinks you have, and the company info that prints on every YGE
// document. Refactored to use the shared component library.

import Link from 'next/link';

import { AppShell, Button, Card, PageHeader, RoleBadge } from '../../components';
import { signOut } from '../login/actions';
import { getCurrentUser } from '../../lib/auth';

export default function ProfilePage() {
  const user = getCurrentUser();
  if (!user) {
    return (
      <AppShell>
        <main className="mx-auto max-w-2xl px-6 py-12">
          <p className="text-sm text-gray-600">Not signed in.</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader
          title="Your account"
          subtitle="What the app knows about you. Editing this lands in a later phase."
        />

        <Card className="mb-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name" value={user.name} />
            <Field label="Email" value={user.email} />
            <Field label="Role" valueNode={<RoleBadge role={user.role} size="md" />} />
            <Field label="Sign-in method" value="Email allowlist (dev)" />
          </div>
          <div className="mt-5 border-t border-gray-100 pt-4">
            <form action={signOut}>
              <Button type="submit" variant="secondary" size="md">
                Sign out
              </Button>
            </form>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Company info</h2>
          <p className="mb-3 text-xs text-gray-500">
            This data prints on every transmittal, lien waiver, certified payroll, and bid envelope. To edit it, go to{' '}
            <Link href="/brand" className="text-blue-700 hover:underline">/brand</Link>.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Legal name" value="Young General Engineering, Inc" />
            <Field label="Address" value="19645 Little Woods Rd, Cottonwood CA 96022" />
            <Field label="CSLB license" value="1145219" />
            <Field label="DIR number" value="2000018967" />
            <Field label="DOT number" value="4528204" />
            <Field label="NAICS" value="115310" />
            <Field label="PSC codes" value="F003, F004" />
            <Field label="President" value="Brook L Young (707-499-7065)" />
            <Field label="Vice President" value="Ryan D Young (707-599-9921)" />
          </div>
        </Card>
      </main>
    </AppShell>
  );
}

function Field({ label, value, valueNode }: { label: string; value?: string; valueNode?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm text-gray-900">{valueNode ?? value}</div>
    </div>
  );
}
