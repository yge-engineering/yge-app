// /portal/sub/estimates/[id] — sub's view of a YGE estimate they
// were listed on. Verifies the sub is genuinely linked before
// rendering anything.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Money } from '../../../../../components/money';
import { getCurrentUser } from '../../../../../lib/auth';
import { currentUserCan } from '../../../../../lib/permissions';
import type { PricedEstimate, Vendor } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchVendors(): Promise<Vendor[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/vendors`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { vendors: Vendor[] }).vendors;
  } catch {
    return [];
  }
}

async function fetchEstimate(id: string): Promise<PricedEstimate | null> {
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/priced-estimates/${encodeURIComponent(id)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { estimate?: PricedEstimate };
    return body.estimate ?? null;
  } catch {
    return null;
  }
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export default async function SubEstimateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!currentUserCan('portal:sub')) {
    redirect('/login');
  }
  const me = getCurrentUser();
  if (!me?.email) redirect('/portal/sub');

  const vendors = await fetchVendors();
  const myVendor = vendors.find(
    (v) => v.email && v.email.toLowerCase() === me.email.toLowerCase(),
  );
  if (!myVendor) notFound();

  const est = await fetchEstimate(params.id);
  if (!est) notFound();

  const myNameNorm = normalize(myVendor.legalName);
  const dbaNorm = myVendor.dbaName ? normalize(myVendor.dbaName) : null;
  const lic = myVendor.cslbLicense?.trim().toLowerCase();
  const matchingSubBids = (est.subBids ?? []).filter((sb) => {
    const nameNorm = normalize(sb.contractorName);
    const sbLic = sb.cslbLicense?.trim().toLowerCase();
    if (lic && sbLic && lic === sbLic) return true;
    if (nameNorm === myNameNorm) return true;
    if (dbaNorm && nameNorm === dbaNorm) return true;
    return false;
  });
  if (matchingSubBids.length === 0) {
    // Sub isn't listed on this estimate.
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/portal/sub"
            className="text-xs text-yge-blue-700 hover:underline"
          >
            ← Back to sub portal
          </Link>
          <h1 className="mt-1 text-xl font-bold text-yge-blue-900">
            {est.projectName}
          </h1>
          <p className="text-xs text-gray-600">
            {est.ownerAgency ? `${est.ownerAgency} · ` : ''}
            {est.location ?? ''}
            {est.bidDueDate ? ` · bid due ${est.bidDueDate}` : ''}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Your sub-bid listing ({matchingSubBids.length})
          </h2>
          <ul className="mt-2 divide-y divide-gray-100 text-sm">
            {matchingSubBids.map((sb) => (
              <li key={sb.id} className="py-3">
                <div className="font-semibold text-gray-900">
                  {sb.contractorName}
                </div>
                <div className="text-xs text-gray-700">
                  Portion: {sb.portionOfWork}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-600">
                  <span className="font-mono">
                    <Money cents={sb.bidAmountCents} />
                  </span>
                  {sb.cslbLicense ? <span>CSLB {sb.cslbLicense}</span> : null}
                  {sb.dirRegistration ? (
                    <span>DIR {sb.dirRegistration}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-[11px] text-gray-500">
          If any of this looks wrong, email{' '}
          <a
            href="mailto:bids@youngge.com"
            className="text-yge-blue-700 underline"
          >
            bids@youngge.com
          </a>{' '}
          before bid open.
        </p>
      </div>
    </main>
  );
}
