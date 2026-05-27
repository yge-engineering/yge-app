// RequiredBidFormsCard — bid-day cockpit panel that lists the
// PDF compliance forms YGE has to file with this specific bid,
// derived from the owner agency string + bid total.
//
// Each row deep-links into /pdf-forms/<mappingId> so the
// estimator can pre-fill + download in one click.

import Link from 'next/link';

import {
  classifyAgencyType,
  requiredBidFormsFor,
  type PricedEstimate,
  type PricedEstimateTotals,
  type RequiredFormRef,
} from '@yge/shared';

interface Props {
  estimate: PricedEstimate;
  totals: PricedEstimateTotals;
}

export function RequiredBidFormsCard({ estimate, totals }: Props) {
  const agencyType = classifyAgencyType(
    estimate.ownerAgency,
    totals.bidTotalCents,
  );
  const forms = requiredBidFormsFor(agencyType, totals.bidTotalCents);
  const required = forms.filter((f) => f.alwaysRequired);
  const conditional = forms.filter((f) => !f.alwaysRequired);

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <header className="mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Required compliance forms
        </h3>
        <p className="mt-0.5 text-[11px] text-gray-600">
          Derived from owner agency
          {estimate.ownerAgency && (
            <>
              {' '}(<span className="font-medium">{estimate.ownerAgency}</span>)
            </>
          )}
          {' · '}classified as{' '}
          <span className="font-medium">{agencyType}</span>
        </p>
      </header>

      {required.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {required.map((f) => (
            <FormRow key={f.mappingId} form={f} />
          ))}
        </ul>
      )}

      {conditional.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-gray-600">
            {conditional.length} conditional form
            {conditional.length === 1 ? '' : 's'} (not required at this bid total)
          </summary>
          <ul className="mt-2 space-y-1.5 pl-2">
            {conditional.map((f) => (
              <FormRow key={f.mappingId} form={f} dim />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function FormRow({ form, dim }: { form: RequiredFormRef; dim?: boolean }) {
  return (
    <li className={dim ? 'text-gray-600' : 'text-gray-900'}>
      <Link
        href={`/pdf-forms/${form.mappingId}`}
        className="font-medium text-yge-blue-500 hover:underline"
      >
        {form.label}
      </Link>
      <div className={`text-xs ${dim ? 'text-gray-500' : 'text-gray-600'}`}>
        {form.why}
      </div>
    </li>
  );
}
