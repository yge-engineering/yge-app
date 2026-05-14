import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { NewsletterPanel } from './newsletter-panel';

export default function CustomerNewsletterPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customer newsletter" subtitle="Compose a generic outreach email with all customer emails pre-filled." />
        <p className="mb-4 text-xs text-gray-600">
          Edit the subject + body below, then click 'Open in Mail' to launch
          your mail client with everyone BCC'd. (Uses{' '}
          <Link href="/customers/email-list" className="text-yge-blue-700 hover:underline">email-list</Link>{' '}
          under the hood.)
        </p>
        <NewsletterPanel />
      </main>
    </AppShell>
  );
}
