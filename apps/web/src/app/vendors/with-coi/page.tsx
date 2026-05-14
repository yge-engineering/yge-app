import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function WithCoiPlaceholder() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Vendors with COI on file (preview)" subtitle="Will list vendors with a current certificate of insurance recorded." />
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-700">
          The full COI tracking is in progress. Today:
          <ul className="mt-2 list-disc pl-6 text-sm">
            <li><Link href="/vendors/coi-aging" className="text-yge-blue-700 hover:underline">/vendors/coi-aging</Link> — chase expiring certificates</li>
            <li><Link href="/vendors" className="text-yge-blue-700 hover:underline">/vendors</Link> — full vendor master</li>
          </ul>
        </p>
        <p className="mt-3 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-700">
          Planned next:
          <ul className="mt-2 list-disc pl-6 text-sm">
            <li>Upload + parse the ACORD 25 PDF for each sub</li>
            <li>Track named-additional-insured, waiver-of-subrogation, primary-non-contributory clauses</li>
            <li>Auto-renewal reminder workflow</li>
            <li>Live count on this page once data is recorded</li>
          </ul>
        </p>
      </main>
    </AppShell>
  );
}
