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

import Link from 'next/link';

import { AppShell, PageHeader } from '../../../components';
import { PrintButton } from '@/components/print-button';
import {
  YGE_BONDING_PROFILE,
  YGE_COMPANY_INFO,
  YGE_INSURANCE_PROFILE,
  bondingCapacityState,
  formatCompanyAddressOneLine,
  formatUSD,
  policyExpiryState,
  type BondingProfile,
  type InsuranceProfile,
  type InsurancePolicy,
} from '@yge/shared';

const profile = YGE_COMPANY_INFO;
const bonding = YGE_BONDING_PROFILE;
const insurance = YGE_INSURANCE_PROFILE;

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
          title="Master business profile (read-only summary)"
          subtitle="Static company-info view. For the editable DB-backed profile (officers, insurance policies, bonding capacity), use /master-profile."
        />

        <div className="no-print mb-4 mt-2 flex flex-wrap gap-2">
          <Link
            href="/master-profile"
            className="rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700"
          >
            Open editable master profile →
          </Link>
        </div>

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

          <Section title="Bonding">
            <BondingBlock profile={bonding} />
          </Section>

          <Section title="Insurance">
            <InsuranceBlock profile={insurance} />
          </Section>

          <Section title="Employee roster">
            <p className="px-3 py-2 text-sm italic text-gray-600">
              Field crew + office roster lives at{' '}
              <Link href="/crew" className="text-yge-blue-500 hover:underline">
                /crew
              </Link>{' '}
              (current list, hire dates, classifications) and{' '}
              <Link href="/dot-pool" className="text-yge-blue-500 hover:underline">
                /dot-pool
              </Link>{' '}
              (driver pool for FMCSA Part 382). Time-card +
              certification surfaces hang off the per-employee detail
              page from there.
            </p>
          </Section>
        </div>

        <p className="no-print mt-8 rounded border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
          <strong>Editing:</strong> the values above are the static
          seed read from <code>packages/shared/src/company.ts</code>.
          The DB-backed editable copy with bonding, insurance,
          officers, banking, and an audit trail lives at{' '}
          <Link href="/master-profile" className="text-yge-blue-700 hover:underline">
            /master-profile
          </Link>
          . Saving an edit there flips the /go-live readiness row
          from amber to green.
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

function NotConfigured({ what }: { what: string }) {
  return (
    <p className="px-3 py-2 text-sm italic text-gray-600">
      {what} not configured in the static company-info seed. The
      DB-backed editable copy at{' '}
      <Link href="/master-profile" className="text-yge-blue-500 hover:underline">
        /master-profile
      </Link>{' '}
      is the real source of truth — saving an edit there is the
      right way to populate it.
    </p>
  );
}

function BondingBlock({ profile }: { profile: BondingProfile | null }) {
  if (!profile) return <NotConfigured what="Bonding profile" />;
  const state = bondingCapacityState(profile, new Date());
  return (
    <>
      <Row label="Surety carrier" value={profile.suretyName} />
      {profile.agentName && <Row label="Agent" value={profile.agentName} />}
      {profile.agentContact && (
        <Row label="Agent contact" value={profile.agentContact} />
      )}
      <Row
        label="Aggregate capacity"
        value={formatUSD(profile.aggregateCapacityCents)}
      />
      <Row
        label="Single-project capacity"
        value={formatUSD(profile.singleProjectCapacityCents)}
      />
      <Row
        label="Current bonded WOH"
        value={`${formatUSD(profile.currentBondedWorkOnHandCents)} (${state.utilizationPercent}% used)`}
      />
      <Row
        label="Remaining capacity"
        value={formatUSD(state.remainingAggregateCapacityCents)}
      />
      <Row
        label="Renews"
        value={`${profile.renewalDate} (${state.daysUntilRenewal} days)`}
      />
      {profile.amBestRating && (
        <Row label="A.M. Best rating" value={profile.amBestRating} />
      )}
      {profile.treasuryListed !== undefined && (
        <Row
          label="Treasury listed"
          value={profile.treasuryListed ? 'Yes' : 'No'}
        />
      )}
    </>
  );
}

function InsuranceBlock({ profile }: { profile: InsuranceProfile | null }) {
  if (!profile) return <NotConfigured what="Insurance profile" />;
  return (
    <>
      <PolicyRow label="General Liability" policy={profile.generalLiability} />
      <PolicyRow label="Commercial Auto" policy={profile.commercialAuto} />
      <PolicyRow label="Workers Comp" policy={profile.workersComp} />
      {profile.umbrella && (
        <PolicyRow label="Umbrella" policy={profile.umbrella} />
      )}
      {profile.brokerName && <Row label="Broker" value={profile.brokerName} />}
      {profile.brokerContact && (
        <Row label="Broker contact" value={profile.brokerContact} />
      )}
    </>
  );
}

const SEVERITY_BADGE: Record<
  ReturnType<typeof policyExpiryState>['severity'],
  { label: string; cls: string }
> = {
  ok: { label: 'OK', cls: 'bg-green-100 text-green-800' },
  soon: { label: 'Renew soon', cls: 'bg-yellow-100 text-yellow-900' },
  critical: { label: 'Renew now', cls: 'bg-orange-100 text-orange-900' },
  expired: { label: 'Expired', cls: 'bg-red-100 text-red-900' },
};

function PolicyRow({ label, policy }: { label: string; policy: InsurancePolicy }) {
  const state = policyExpiryState(policy, new Date());
  const badge = SEVERITY_BADGE[state.severity];
  const limits: string[] = [];
  if (policy.eachOccurrenceLimitCents != null) {
    limits.push(`each occ ${formatUSD(policy.eachOccurrenceLimitCents)}`);
  }
  if (policy.aggregateLimitCents != null) {
    limits.push(`aggregate ${formatUSD(policy.aggregateLimitCents)}`);
  }
  return (
    <div className="px-4 py-2 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-semibold text-gray-900">{label}</div>
        <span
          className={`whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-gray-700">
        {policy.carrier} · #{policy.policyNumber}
      </div>
      <div className="text-xs text-gray-700">
        Expires {policy.expiryDate} ({state.daysUntilExpiry}d)
        {limits.length > 0 && ` · ${limits.join(', ')}`}
      </div>
      {policy.brokerNote && (
        <div className="mt-1 text-[11px] italic text-gray-600">
          {policy.brokerNote}
        </div>
      )}
    </div>
  );
}
