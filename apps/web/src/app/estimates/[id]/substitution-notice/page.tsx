// /estimates/[id]/substitution-notice — print-ready PCC §4107 sub
// substitution request to the awarding authority.
//
// Query-param driven so the user can deep-link a specific notice:
//   ?subId       — which listed sub is being substituted (defaults to first)
//   ?ground      — statutory ground (defaults to PERFORM_FAILURE)
//   ?groundDetail— free-form facts to print under the boilerplate
//   ?rName,?rAddr,?rCslb,?rDir,?rAmtCents — optional replacement-sub block
//
// The page renders the letter and a small sidebar form whose submit updates
// the same searchParams. No client JS required.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  YGE_COMPANY_INFO,
  buildSubstitutionNotice,
  listSubstitutionGrounds,
  type PricedEstimate,
  type PricedEstimateTotals,
  type SubBid,
  type SubstitutionGround,
  type SubstitutionNoticeReplacement,
} from '@yge/shared';
import { AppShell } from '../../../../components';
import { PrintButton } from '@/components/print-button';
import { Letterhead } from '@/components/letterhead';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface FullResponse {
  estimate: PricedEstimate;
  totals: PricedEstimateTotals;
}

async function fetchEstimate(id: string): Promise<FullResponse | null> {
  const res = await fetch(`${apiBaseUrl()}/api/priced-estimates/${id}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return (await res.json()) as FullResponse;
}

const VALID_GROUNDS = new Set<SubstitutionGround>([
  'EXECUTE_FAILURE',
  'PERFORM_FAILURE',
  'BANKRUPTCY',
  'BOND_FAILURE',
  'LICENSE_LOSS',
  'DIR_REG_LAPSED',
  'MUTUAL_CONSENT',
  'COMPLIANCE_FAILURE',
]);

function pickGround(raw: string | undefined): SubstitutionGround {
  if (raw && (VALID_GROUNDS as Set<string>).has(raw)) {
    return raw as SubstitutionGround;
  }
  return 'PERFORM_FAILURE';
}

function parseCents(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

export default async function SubstitutionNoticePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: {
    subId?: string;
    ground?: string;
    groundDetail?: string;
    rName?: string;
    rAddr?: string;
    rCslb?: string;
    rDir?: string;
    rAmtCents?: string;
    signer?: string;
  };
}) {
  const data = await fetchEstimate(params.id);
  if (!data) notFound();
  const { estimate } = data;

  const subs: SubBid[] = estimate.subBids;
  if (subs.length === 0) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl p-8">
          <Link href={`/estimates/${estimate.id}`} className="text-yge-blue-500 hover:underline">
            &larr; Back to estimate
          </Link>
          <h1 className="mt-4 text-xl font-bold">§4107 substitution request</h1>
          <p className="mt-2 text-sm text-gray-700">
            This estimate has no listed subcontractors, so there is nothing to
            substitute. Add subs to the bid first.
          </p>
        </main>
      </AppShell>
    );
  }

  const selectedSubId = searchParams.subId ?? subs[0]?.id;
  const sub = subs.find((s) => s.id === selectedSubId) ?? subs[0];
  if (!sub) notFound();

  const ground = pickGround(searchParams.ground);
  const groundDetail = searchParams.groundDetail?.trim();

  let replacement: SubstitutionNoticeReplacement | undefined;
  const rName = searchParams.rName?.trim();
  if (rName && rName.length > 0) {
    replacement = {
      contractorName: rName,
      address: searchParams.rAddr?.trim() || undefined,
      cslbLicense: searchParams.rCslb?.trim() || undefined,
      dirRegistration: searchParams.rDir?.trim() || undefined,
      bidAmountCents: parseCents(searchParams.rAmtCents),
    };
  }

  const signerKey: 'vp' | 'president' =
    searchParams.signer === 'president' ? 'president' : 'vp';
  const signer =
    signerKey === 'president' ? YGE_COMPANY_INFO.president : YGE_COMPANY_INFO.vicePresident;

  const notice = buildSubstitutionNotice(estimate, sub, ground, {
    groundDetail,
    replacement,
    signer,
  });

  const grounds = listSubstitutionGrounds();

  return (
    <AppShell>
      <style>{`
        @page { margin: 0.75in 0.75in; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print mx-auto max-w-5xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-700">
          <Link
            href={`/estimates/${estimate.id}`}
            className="text-yge-blue-500 hover:underline"
          >
            &larr; Back to estimate
          </Link>
          <PrintButton />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
          <aside className="no-print rounded border border-gray-200 bg-white p-3 text-xs shadow-sm">
            <h2 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Notice parameters
            </h2>
            <form method="GET" className="mt-2 space-y-3">
              <label className="block">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Listed sub
                </span>
                <select
                  name="subId"
                  defaultValue={sub.id}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                >
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.contractorName} — {s.portionOfWork.slice(0, 40)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Ground for substitution
                </span>
                <select
                  name="ground"
                  defaultValue={ground}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                >
                  {grounds.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.statuteRef} — {g.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Signed by
                </span>
                <select
                  name="signer"
                  defaultValue={signerKey}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                >
                  <option value="vp">
                    {YGE_COMPANY_INFO.vicePresident.name} (VP)
                  </option>
                  <option value="president">
                    {YGE_COMPANY_INFO.president.name} (President)
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Underlying facts (optional)
                </span>
                <textarea
                  name="groundDetail"
                  defaultValue={groundDetail ?? ''}
                  rows={4}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  placeholder="Demand letter dates, conversations, the timeline that supports the chosen ground."
                />
              </label>

              <fieldset className="rounded border border-gray-200 p-2">
                <legend className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Proposed replacement (optional)
                </legend>
                <label className="block">
                  <span className="block text-[10px] text-gray-500">Name</span>
                  <input
                    type="text"
                    name="rName"
                    defaultValue={replacement?.contractorName ?? ''}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  />
                </label>
                <label className="mt-2 block">
                  <span className="block text-[10px] text-gray-500">Address (one line)</span>
                  <input
                    type="text"
                    name="rAddr"
                    defaultValue={replacement?.address ?? ''}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  />
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-[10px] text-gray-500">CSLB #</span>
                    <input
                      type="text"
                      name="rCslb"
                      defaultValue={replacement?.cslbLicense ?? ''}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[10px] text-gray-500">DIR #</span>
                    <input
                      type="text"
                      name="rDir"
                      defaultValue={replacement?.dirRegistration ?? ''}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                    />
                  </label>
                </div>
                <label className="mt-2 block">
                  <span className="block text-[10px] text-gray-500">Bid amount (cents)</span>
                  <input
                    type="number"
                    name="rAmtCents"
                    min={0}
                    defaultValue={replacement?.bidAmountCents ?? ''}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  />
                </label>
              </fieldset>

              <button
                type="submit"
                className="w-full rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700"
              >
                Update letter
              </button>
            </form>
          </aside>

          <article className="bg-white p-8 text-sm leading-relaxed shadow-sm print:shadow-none">
            <Letterhead />

            <div className="mt-6 text-right text-xs text-gray-600">{notice.date}</div>

            <div className="mt-2 text-xs">
              <div className="font-semibold">{notice.addressee.agency}</div>
              {notice.addressee.addressLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>

            <h1 className="mt-4 border-b border-black pb-1 text-sm font-bold uppercase tracking-wide">
              {notice.subjectLine}
            </h1>

            <p className="mt-3">{notice.salutation}</p>

            {notice.bodyParagraphs.map((para, i) => (
              <p className="mt-3" key={i}>
                {para}
              </p>
            ))}

            <div className="mt-4 rounded border border-black bg-gray-50 p-3 text-xs print:bg-white">
              <div className="font-semibold uppercase tracking-wide">
                Listed subcontractor proposed for substitution
              </div>
              <div className="mt-1">
                <span className="font-semibold">Name:</span>{' '}
                {notice.originalSub.contractorName}
              </div>
              <div>
                <span className="font-semibold">Portion of work:</span>{' '}
                {notice.originalSub.portionOfWork}
              </div>
              <div>
                <span className="font-semibold">Listed bid amount:</span>{' '}
                {notice.originalSub.bidAmountUsd}
              </div>
              {(notice.originalSub.cslbLicense || notice.originalSub.dirRegistration) && (
                <div className="mt-1 text-[11px] text-gray-700">
                  {notice.originalSub.cslbLicense && (
                    <span>CSLB #{notice.originalSub.cslbLicense}</span>
                  )}
                  {notice.originalSub.cslbLicense && notice.originalSub.dirRegistration && (
                    <span> · </span>
                  )}
                  {notice.originalSub.dirRegistration && (
                    <span>DIR #{notice.originalSub.dirRegistration}</span>
                  )}
                </div>
              )}
            </div>

            <p className="mt-4 font-semibold">
              Ground for substitution ({notice.groundStatuteRef}):
            </p>
            <p className="mt-1 text-sm italic">{notice.groundLabel}</p>
            <p className="mt-2">{notice.groundStatement}</p>

            {notice.groundDetail && (
              <div className="mt-3 whitespace-pre-line border-l-4 border-gray-300 pl-3 text-sm">
                {notice.groundDetail}
              </div>
            )}

            {notice.replacementProposal && (
              <div className="mt-4 rounded border border-green-500 bg-green-50 p-3 text-xs print:bg-white">
                <div className="font-semibold uppercase tracking-wide">Proposed replacement</div>
                <div className="mt-1 font-semibold">
                  {notice.replacementProposal.contractorName}
                </div>
                {notice.replacementProposal.addressLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
                {(notice.replacementProposal.cslbLicense ||
                  notice.replacementProposal.dirRegistration) && (
                  <div className="mt-1 text-[11px] text-gray-700">
                    {notice.replacementProposal.cslbLicense && (
                      <span>CSLB #{notice.replacementProposal.cslbLicense}</span>
                    )}
                    {notice.replacementProposal.cslbLicense &&
                      notice.replacementProposal.dirRegistration && <span> · </span>}
                    {notice.replacementProposal.dirRegistration && (
                      <span>DIR #{notice.replacementProposal.dirRegistration}</span>
                    )}
                  </div>
                )}
                {notice.replacementProposal.bidAmountUsd && (
                  <div className="mt-1">
                    <span className="font-semibold">Replacement bid amount:</span>{' '}
                    {notice.replacementProposal.bidAmountUsd}
                  </div>
                )}
              </div>
            )}

            <p className="mt-4">{notice.closingParagraph}</p>

            <div className="mt-6">
              <p>{notice.closing.line}</p>
              <div className="mt-10 border-t border-gray-400 pt-1">
                <div className="text-sm font-semibold">{notice.closing.signer.name}</div>
                <div className="text-xs">{notice.closing.signer.title}</div>
                <div className="text-xs">{notice.closing.signer.company}</div>
                <div className="text-xs text-gray-600">
                  {notice.closing.signer.phone} · {notice.closing.signer.email}
                </div>
              </div>
            </div>

            <p className="mt-6 text-[10px] italic text-gray-500">
              Filed under California Public Contract Code §4107. The awarding
              authority is requested to provide written notice and opportunity
              to object to the listed subcontractor named above before
              approving this substitution.
            </p>
          </article>
        </div>
      </div>
    </AppShell>
  );
}
