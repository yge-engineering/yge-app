// /privacy — privacy notice.
//
// Plain English: what data the app collects, how it's stored, and
// what we do with it. Internal-tool tone — short, honest.

import { AppShell, Card, PageHeader } from '../../components';

export default function PrivacyPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="Privacy"
          subtitle="Last updated May 1, 2026"
        />

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">What we collect</h2>
          <ul className="list-disc pl-5 text-sm text-gray-700">
            <li>Your name, work email, and role on the YGE staff list.</li>
            <li>Records you create or edit — jobs, customers, vendors, time cards, daily reports, RFIs, change orders, etc.</li>
            <li>Standard server logs (timestamp, IP, request URL) used for security and debugging.</li>
            <li>A session cookie (httpOnly, 30-day) so you don&apos;t have to sign in every time.</li>
          </ul>
        </Card>

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Where it lives</h2>
          <p className="text-sm text-gray-700">
            Records are stored in a Postgres database hosted on YGE-controlled infrastructure.
            File attachments (photos, PDFs) live in a private object store. The app itself
            runs on Vercel. No data is sold or shared with third parties; only YGE staff and
            named contractors with a signed NDA have access.
          </p>
        </Card>

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Records retention</h2>
          <p className="text-sm text-gray-700">
            We keep records as long as required by California construction law. Public-works
            certified payrolls are kept at least 4 years (CA Labor Code §1776). Tax records
            (AP, AR, payroll) are kept 7 years. Other operational records are kept for the
            life of the project plus statute of limitations on claims (10 years from
            substantial completion under CCP §337.15).
          </p>
        </Card>

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Your access</h2>
          <p className="text-sm text-gray-700">
            You can see your own profile at <code className="rounded bg-gray-100 px-1 font-mono text-xs">/profile</code>.
            To request a copy of all data tied to your account, or to ask for it to be deleted
            after you leave YGE employment, email Ryan at ryoung@youngge.com.
          </p>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-gray-900">No third-party tracking</h2>
          <p className="text-sm text-gray-700">
            The app does not embed Google Analytics, Facebook pixels, advertising trackers,
            or any other third-party telemetry. It is a closed-loop business tool.
          </p>
        </Card>
      </main>
    </AppShell>
  );
}
