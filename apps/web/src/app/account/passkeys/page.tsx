// /account/passkeys — set up Face ID / Touch ID / Windows Hello.
//
// User must be signed in. Once they tap the button below, the browser
// asks the OS to mint a passkey, the public half goes to the server,
// and from then on they can sign in by tapping the "Sign in with Face
// ID" button on /login.

import { AppShell, PageHeader } from '../../../components';
import { requireUser } from '../../../lib/auth';
import { PasskeyRegister } from './passkey-register';

export default function PasskeysPage() {
  const user = requireUser();
  return (
    <AppShell>
      <main className="mx-auto max-w-md px-4 py-6">
        <PageHeader
          title="Face ID / Touch ID sign-in"
          subtitle="Set up a passkey on this device so you can sign in without typing your password."
        />
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm text-gray-700">
            Signed in as <strong>{user.email}</strong>. The passkey will be
            tied to this device — set one up on each device you sign in
            from. Set a nickname if you want to remember which device it
            came from.
          </p>
          <PasskeyRegister />
        </div>
        <p className="mt-4 text-xs text-gray-500">
          Passkeys never leave your device. The server only stores a
          public key it can use to verify signatures — it can't sign in
          on your behalf.
        </p>
      </main>
    </AppShell>
  );
}
