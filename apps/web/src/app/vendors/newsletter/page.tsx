import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { VendorNewsletterPanel } from './newsletter-panel';

export default function VendorNewsletterPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Vendor newsletter" subtitle="Compose a generic outreach email with all vendor emails pre-filled." />
        <p className="mb-4 text-xs text-gray-600">
          Edit the subject + body below, then click 'Open in Mail' to launch
          your mail client with everyone BCC'd. (Uses{' '}
          <Link href="/vendors/email-list" className="text-yge-blue-700 hover:underline">email-list</Link>{' '}
          under the hood.)
        </p>
        <VendorNewsletterPanel />
      </main>
    </AppShell>
  );
}
