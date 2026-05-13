// /inbox-triage — full-depth AI inbox classification.

import { AppShell, PageHeader } from '../../components';
import { InboxTriageFull } from '../../components/inbox-triage-full';
import { getCurrentUser } from '../../lib/auth';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchMicrosoftConnected(email: string): Promise<boolean> {
  if (!email) return false;
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/microsoft/status?email=${encodeURIComponent(email)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return false;
    const body = (await res.json()) as { connected?: boolean };
    return Boolean(body.connected);
  } catch {
    return false;
  }
}

export default async function InboxTriagePage() {
  const user = getCurrentUser();
  const microsoftConnected = user?.email
    ? await fetchMicrosoftConnected(user.email)
    : false;

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="Inbox triage"
          subtitle="AI classifies your last 25 emails into 10 categories. Drill in, draft AP invoices from vendor bills, file emails to jobs."
        />
        <InboxTriageFull
          email={user?.email ?? ''}
          microsoftConnected={microsoftConnected}
        />
      </main>
    </AppShell>
  );
}
