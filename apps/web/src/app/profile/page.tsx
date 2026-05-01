// /profile — signed-in user's account page.
//
// Plain English: shows who you are right now, what role the system
// thinks you have, and the company info that prints on every YGE
// document. Also a quick sign-out shortcut.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import { signOut } from '../login/actions';
import { getCurrentUser } from '../../lib/auth';

function roleLabel(role: 'PRESIDENT' | 'VP' | 'OFFICE' | 'FOREMAN' | 'CREW'): string {
  switch (role) {
    case 'PRESIDENT': return 'President';
    case 'VP': return 'Vice President';
    case 'OFFICE': return 'Office';
    case 'FOREMAN': return 'Foreman';
    case 'CREW': return 'Crew';
  }
}

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
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Your account</h1>
          <p className="mt-1 text-sm text-gray-600">
            What the app knows about you. Editing this lands in a later phase.
          </p>
        </header>

        <section className="mb-6 rounded-md border border-gray-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name" value={user.name} />
            <Field label="Email" value={user.email} />
            <Field label="Role" value={roleLabel(user.role)} />
            <Field label="Sign-in method" value="Email allowlist (dev)" />
          </div>
          <div className="mt-5 border-t border-gray-100 pt-4">
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </section>

        <section className="mb-6 rounded-md border border-gray-200 bg-white p-5">
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
        </section>
      </main>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm text-gray-900">{value}</div>
    </div>
  );
}
