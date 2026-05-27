// /settings/company — master business profile (read-only view).
//
// First step toward the editable master business profile in the
// Phase 1 MVP scope. Today reads from the static YGE_COMPANY_INFO
// export; later bundles add Prisma storage + an edit form + a
// permission gate (Ryan/Brook can edit, office can view).
//
// Page acts as a single source of truth for vendor onboarding,
// surety renewal packets, agency questionnaires, COI requests —
// any place YGE has to recite the same set of facts. Printable
// so it can sit on the office wall or in a vendor folder.

import { AppShell, PageHeader } from '../../../components';
import { PrintButton } from '@/components/print-button';
import {
  YGE_COMPANY_INFO,
  formatCompanyAddressOneLine,
} from '@yge/shared';

const profile = YGE_COMPANY_INFO;

export default function CompanyProfilePage() {
  return (
    <AppShell>
      <style>{`
        @page { margin: 0.6in 0.75in; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <main className="mx-auto max-w-3xl p-6 sm:p-8 print:max-w-none print:p-0">
        <div className="no-print mb-4 flex items-center justify-end">
          <PrintButton />
        </div>

        <PageHeader
          title="Master business profile"
          subtitle="Single source of truth for licenses, officers, and federal codes. Read by every print artifact (bid summary, cover letter, CPR header, AP letterhead). Editable form coming in a future bundle."
        />

        <div className="mt-6 space-y-4">
          <Section title="Legal entity">
            <Row label="Legal name" value={profile.legalName} />
            <Row label="DBA / short" value={profile.shortName} />
            <Row label="Tagline" value={profile.tagline} />
            <Row label="Address" value={formatCompanyAddressOneLine(profile)} />
          </Section>

          <Section title="Licenses & registrations">
            <Row label="CSLB license #" value={profile.cslbLicense} />
            <Row label="DIR registration #" value={profile.dirNumber} />
            <Row label="USDOT #" value={profile.dotNumber} />
          </Section>

          <Section title="Federal codes">
            <Row label="NAICS code(s)" value={profile.naicsCodes.join(', ')} />
            <Row label="PSC code(s)" value={profile.pscCodes.join(', ')} />
          </Section>

          <Section title="Officers">
            <OfficerRow contact={profile.president} />
            <OfficerRow contact={profile.vicePresident} />
          </Section>

          <Section title="Bid defaults">
            <Row
              label="Default bid validity"
              value={`${profile.bidValidityDays} calendar days`}
            />
          </Section>

          <Section title="Bonding (placeholder — needs DB)">
            <p className="px-3 py-2 text-sm italic text-gray-600">
              Surety, aggregate capacity, single-project capacity, current
              bonded work-on-hand, and renewal date will live here once the
              profile is editable. For now Brook tracks these on /bond-capacity.
            </p>
          </Section>

          <Section title="Insurance (placeholder — needs DB)">
            <p className="px-3 py-2 text-sm italic text-gray-600">
              GL, auto, workers comp, umbrella — carriers, policy numbers,
              limits, expiry dates. Currently maintained outside the app;
              uploaded COIs land in <code>uploads/</code>.
            </p>
          </Section>

          <Section title="Employee profile v1 (placeholder — needs DB)">
            <p className="px-3 py-2 text-sm italic text-gray-600">
              Field crew + office roster with certs, classifications, DOB,
              hire date, emergency contacts. Foundation for the time-card
              system + CPR generator + employee self-service portal.
            </p>
          </Section>
        </div>

        <p className="no-print mt-8 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Editing:</strong> these fields are hard-coded in{' '}
          <code>packages/shared/src/company.ts</code> for now. To change a
          value, edit the file and ship a bundle. The next phase introduces
          a Prisma-backed profile + an edit form here.
        </p>
      </main>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <header className="border-b border-gray-100 bg-gray-50 px-4 py-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-600">
          {title}
        </h2>
      </header>
      <div className="divide-y divide-gray-100">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <dl className="grid grid-cols-[10rem_1fr] gap-3 px-4 py-2 text-sm">
      <dt className="text-gray-600">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </dl>
  );
}

function OfficerRow({
  contact,
}: {
  contact: typeof YGE_COMPANY_INFO.president;
}) {
  return (
    <div className="px-4 py-2 text-sm">
      <div className="font-semibold text-gray-900">
        {contact.name}{' '}
        <span className="text-xs font-normal text-gray-500">— {contact.title}</span>
      </div>
      <div className="text-xs text-gray-700">
        {contact.phone} · <a href={`mailto:${contact.email}`} className="text-yge-blue-500 hover:underline">{contact.email}</a>
      </div>
    </div>
  );
}
