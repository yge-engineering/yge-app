// /admin/session — current-session diagnostic.
//
// Plain English: shows what the API thinks of the cookie in this
// browser. Useful for debugging "why am I logged in as the wrong
// person?" or "did YGE_SESSION_SECRET get deployed?". Read-only.

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { SessionDiagnostic } from './session-diagnostic';

export default function SessionDiagnosticPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-6">
        <PageHeader
          title="Session diagnostic"
          subtitle="What the API sees in your cookie right now. Signed = the HMAC verified, so the cookie is trustworthy; unsigned = the API accepted it under the legacy backward-compat path."
        />
        <SessionDiagnostic />
      </main>
    </AppShell>
  );
}
