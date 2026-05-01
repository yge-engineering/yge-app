// /terms — terms of use.
//
// Plain English: the legal page covering what users can do with the
// app. Internal-tool flavor — short, accurate, no boilerplate.

import { AppShell, Card, PageHeader } from '../../components';

export default function TermsPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="Terms of use"
          subtitle="Last updated May 1, 2026"
        />

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Who this is for</h2>
          <p className="text-sm text-gray-700">
            This is the internal estimating, dispatch, and bookkeeping app for{' '}
            <strong>Young General Engineering, Inc.</strong>, a California heavy-civil contractor
            (CSLB 1145219, DIR 2000018967). Access is limited to employees and authorized
            collaborators. By signing in you agree to use the system in good faith and only for
            YGE business.
          </p>
        </Card>

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Confidentiality</h2>
          <p className="text-sm text-gray-700">
            All data you see — including job costs, vendor pricing, customer information,
            employee records, and bid strategy — is confidential to YGE. Don&apos;t share screens,
            export data, or copy contents to outside systems without written authorization from
            an officer of the company.
          </p>
        </Card>

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Acceptable use</h2>
          <ul className="list-disc pl-5 text-sm text-gray-700">
            <li>Only sign in on devices you control. Don&apos;t share your login.</li>
            <li>Don&apos;t attempt to access records outside your role&apos;s scope.</li>
            <li>If you spot a security issue, tell Ryan at 707-599-9921. Don&apos;t exploit it.</li>
            <li>Don&apos;t introduce malware, scrape data programmatically, or reverse-engineer the system.</li>
          </ul>
        </Card>

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">No warranty</h2>
          <p className="text-sm text-gray-700">
            The app is provided as-is. While we work hard to keep numbers correct, you remain
            responsible for verifying calculations, certified payroll filings, and contract
            obligations against the underlying records.
          </p>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Contact</h2>
          <p className="text-sm text-gray-700">
            Questions: Ryan D. Young, VP — ryoung@youngge.com — 707-599-9921.
            <br />
            Mailing: 19645 Little Woods Rd, Cottonwood CA 96022.
          </p>
        </Card>
      </main>
    </AppShell>
  );
}
