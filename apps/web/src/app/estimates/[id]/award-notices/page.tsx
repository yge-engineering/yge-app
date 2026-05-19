// /estimates/[id]/award-notices — print-ready stack of §4104 award-notice
// letters, one per listed sub. Shown only after the bid is marked awarded;
// for any other status the page prints a warning at the top so the user
// doesn't accidentally fire off letters from the bid that didn't land.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  YGE_COMPANY_INFO,
  buildSubAwardNotice,
  classifySubBids,
  computeEstimateTotals,
  type PricedEstimate,
  type PricedEstimateTotals,
  type SubAwardNotice,
  type SubBid,
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

type SignerKey = 'vp' | 'president';
function pickSigner(key: SignerKey) {
  return key === 'president' ? YGE_COMPANY_INFO.president : YGE_COMPANY_INFO.vicePresident;
}

export default async function AwardNoticesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { signer?: string };
}) {
  const signerKey: SignerKey =
    searchParams.signer === 'president' ? 'president' : 'vp';
  const signer = pickSigner(signerKey);
  const data = await fetchEstimate(params.id);
  if (!data) notFound();
  const { estimate } = data;
  const totals = computeEstimateTotals(estimate);
  const classification = classifySubBids(
    estimate.subBids,
    totals.bidTotalCents,
    estimate.projectType,
  );

  // Letter for every sub that landed on the printed §4104 list (must-list
  // first, then borderline — same order the sub-list page prints).
  const recipients: SubBid[] = [
    ...classification.mustList,
    ...classification.borderline,
  ].sort((a, b) => b.bidAmountCents - a.bidAmountCents);

  const notices: Array<{ sub: SubBid; notice: SubAwardNotice }> = recipients.map((sub) => ({
    sub,
    notice: buildSubAwardNotice(estimate, sub, { signer }),
  }));

  const awarded = estimate.bidStatus === 'awarded';

  return (
    <AppShell>
      <style>{`
        @page { margin: 0.75in 0.75in; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        .award-letter { break-after: page; page-break-after: always; }
        .award-letter:last-child { break-after: auto; page-break-after: auto; }
      `}</style>

      <div className="no-print mx-auto max-w-3xl p-4 text-sm text-gray-700">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/estimates/${estimate.id}`}
            className="text-yge-blue-500 hover:underline"
          >
            &larr; Back to estimate
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-gray-500">Signed by</span>
            <Link
              href={`/estimates/${estimate.id}/award-notices?signer=vp`}
              className={`rounded px-2 py-1 text-xs font-medium ${
                signerKey === 'vp'
                  ? 'bg-yge-blue-500 text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {YGE_COMPANY_INFO.vicePresident.name.split(' ')[0] ?? 'VP'} (VP)
            </Link>
            <Link
              href={`/estimates/${estimate.id}/award-notices?signer=president`}
              className={`rounded px-2 py-1 text-xs font-medium ${
                signerKey === 'president'
                  ? 'bg-yge-blue-500 text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {YGE_COMPANY_INFO.president.name.split(' ')[0] ?? 'President'} (President)
            </Link>
            <PrintButton />
          </div>
        </div>

        {!awarded && (
          <div className="mb-3 rounded border border-amber-400 bg-amber-50 p-3 text-amber-900">
            <strong>Heads up:</strong> this bid is not marked awarded yet
            ({estimate.bidStatus ?? 'pursuing'}). These letters are drafts — do
            not send them until the agency formally awards the contract.
          </div>
        )}

        {recipients.length === 0 && (
          <div className="rounded border border-yellow-400 bg-yellow-50 p-3">
            <strong>No subs were listed on this bid.</strong> Either the bid was
            fully self-performed or every sub bid was under the §4104 threshold.
            There's nothing to notify.
          </div>
        )}
      </div>

      <main className="mx-auto max-w-3xl px-8 text-black">
        {notices.map(({ sub, notice }) => (
          <LetterArticle key={sub.id} notice={notice} />
        ))}
      </main>
    </AppShell>
  );
}

function LetterArticle({ notice }: { notice: SubAwardNotice }) {
  return (
    <article className="award-letter mb-12 bg-white p-8 text-sm leading-relaxed shadow-sm print:shadow-none">
      <Letterhead />

      <div className="mt-6 text-right text-xs text-gray-600">{notice.date}</div>

      <div className="mt-2 text-xs">
        <div className="font-semibold">{notice.addressee.contractorName}</div>
        {notice.addressee.addressLines.map((line) => (
          <div key={line}>{line}</div>
        ))}
        {(notice.addressee.cslbLicense || notice.addressee.dirRegistration) && (
          <div className="mt-1 text-[11px] text-gray-600">
            {notice.addressee.cslbLicense && (
              <span>CSLB #{notice.addressee.cslbLicense}</span>
            )}
            {notice.addressee.cslbLicense && notice.addressee.dirRegistration && (
              <span> · </span>
            )}
            {notice.addressee.dirRegistration && (
              <span>DIR #{notice.addressee.dirRegistration}</span>
            )}
          </div>
        )}
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
        <div className="font-semibold uppercase tracking-wide">Awarded scope</div>
        <div className="mt-1">
          <span className="font-semibold">Portion of work:</span>{' '}
          {notice.scopeBlock.portionOfWork}
        </div>
        <div>
          <span className="font-semibold">Subcontract amount:</span>{' '}
          {notice.scopeBlock.bidAmountUsd}
        </div>
      </div>

      <p className="mt-4 font-semibold">Before we issue the subcontract PO we need:</p>
      <ol className="mt-2 list-decimal pl-5 text-xs">
        {notice.nextSteps.map((step) => (
          <li key={step} className="mt-1">
            {step}
          </li>
        ))}
      </ol>

      <p className="mt-4">{notice.closingParagraph}</p>

      <div className="mt-6 signature-block">
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

      <div className="mt-8 border-t border-gray-400 pt-3 text-xs">
        <div className="font-semibold uppercase tracking-wide text-gray-600">
          Sub countersignature
        </div>
        <p className="mt-2">{notice.countersignaturePrompt}</p>
        <div className="mt-8 grid grid-cols-2 gap-6">
          <div>
            <div className="border-b border-gray-500" />
            <div className="mt-1 text-[11px] text-gray-600">Signature</div>
          </div>
          <div>
            <div className="border-b border-gray-500" />
            <div className="mt-1 text-[11px] text-gray-600">Printed name &amp; title</div>
          </div>
          <div>
            <div className="border-b border-gray-500" />
            <div className="mt-1 text-[11px] text-gray-600">Date</div>
          </div>
          <div>
            <div className="border-b border-gray-500" />
            <div className="mt-1 text-[11px] text-gray-600">
              Sub bid amount on file: {notice.scopeBlock.bidAmountUsd}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-[10px] italic text-gray-500">
        Notice prepared from the §4104 designated-subcontractor list as filed
        with the awarding agency. Award price reflects the bid
        listed; any change in scope or price requires a written change order
        before work begins.
      </p>
    </article>
  );
}
