// /sign/[id] — affirmative signing surface for one signature row.
//
// ESIGN/UETA proof: intent (separate Sign button — not a passive
// 'by continuing'), consent (capture of disclosure-text hash plus
// affirmation language), attribution (auth context recorded
// server-side), association (sha256 of the document bytes already
// bound on the row), retention (the row is append-only by design).
//
// Phase-1 supports the TYPED method: signer types their full name,
// checks the consent box, clicks Sign. DRAWN canvas + DocuSign-style
// magic-link OTP land in subsequent commits.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Alert,
  AppShell,
  PageHeader,
} from '../../../components';
import { SignFormOtp } from '@/components/sign-form-otp';
import { SignFormDrawn } from '@/components/sign-form-drawn';
import {
  isLegallyBinding,
  type Signature,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchSignature(id: string): Promise<Signature | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/signatures/${id}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return ((await res.json()) as { signature: Signature }).signature;
  } catch { return null; }
}

const DISCLOSURE_TEXT = `By signing this document electronically, you agree that:
1. Your electronic signature has the same legal effect as a wet-ink signature.
2. You understand the document you are about to sign and have been given a chance to read it.
3. You are signing voluntarily.
4. A record of this signature, including timestamp, IP address, and authentication
   method, will be kept with the signed document.
This consent is governed by the federal ESIGN Act (15 USC §7001) and California's
Uniform Electronic Transactions Act (Cal. Civ. Code §§1633.1 et seq.).`;

const AFFIRMATION_TEXT =
  'I have read the disclosures above and I agree to do business electronically.';

export default async function SignPage({
  params,
}: {
  params: { id: string };
}) {
  const signature = await fetchSignature(params.id);
  if (!signature) notFound();

  const alreadySigned = signature.status !== 'DRAFT';

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-8">
        <div className="mb-6">
          <Link href="/signatures" className="text-sm text-yge-blue-500 hover:underline">
            &larr; All signatures
          </Link>
        </div>

        <PageHeader
          title={signature.document.displayName}
          subtitle={`${signature.document.documentType} · signer ${signature.signer.name} (${signature.signer.email})`}
        />

        {alreadySigned ? (
          <AlreadyDecided signature={signature} />
        ) : (
          <>
            <DocumentSummary signature={signature} />

            <section className="mt-6 rounded-md border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
                Disclosure
              </h2>
              <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
                {DISCLOSURE_TEXT}
              </pre>
            </section>

            {signature.method === 'DRAWN' ? (
              <SignFormDrawn
                apiBaseUrl={publicApiBaseUrl()}
                signatureId={signature.id}
                expectedSignerName={signature.signer.name}
                disclosureText={DISCLOSURE_TEXT}
                affirmationText={AFFIRMATION_TEXT}
              />
            ) : (
              <SignFormOtp
                apiBaseUrl={publicApiBaseUrl()}
                signatureId={signature.id}
                expectedSignerName={signature.signer.name}
                signerEmail={signature.signer.email}
                disclosureText={DISCLOSURE_TEXT}
                affirmationText={AFFIRMATION_TEXT}
              />
            )}
          </>
        )}

        <p className="mt-8 text-xs text-gray-500">
          Phase-1 signing methods: TYPED with email-OTP attribution
          (default for remote signers) and DRAWN with IN_PERSON attribution
          (for the bid binder workflow). The signature row's <code>method</code>
          decides which form renders. DRAWN images flatten into the
          underlying PDF in the finalize step.
        </p>
      </main>
    </AppShell>
  );
}

function DocumentSummary({ signature }: { signature: Signature }) {
  return (
    <section className="mt-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Document
      </h2>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-500">Display name</dt>
        <dd className="font-medium text-gray-900">{signature.document.displayName}</dd>
        <dt className="text-gray-500">Type</dt>
        <dd className="text-gray-900">{signature.document.documentType}</dd>
        <dt className="text-gray-500">Bytes</dt>
        <dd className="text-gray-900">{signature.document.byteLength.toLocaleString()}</dd>
        <dt className="text-gray-500">SHA-256</dt>
        <dd className="font-mono text-xs text-gray-700 break-all">
          {signature.document.sha256}
        </dd>
      </dl>
    </section>
  );
}

function AlreadyDecided({ signature }: { signature: Signature }) {
  if (isLegallyBinding(signature)) {
    return (
      <Alert tone="success" className="mt-4" title="Signed and binding">
        This document was signed{' '}
        {signature.signedAt && <>at <code className="font-mono">{signature.signedAt}</code> </>}
        by {signature.signer.name}. The signature certificate is archived
        and the flattened PDF hash is recorded.
      </Alert>
    );
  }
  if (signature.status === 'VOIDED') {
    return (
      <Alert tone="danger" className="mt-4" title="Voided">
        {signature.voidedReason ?? 'This signature was voided.'}
      </Alert>
    );
  }
  return (
    <Alert tone="warn" className="mt-4" title={`Signature is ${signature.status}`}>
      No further action available from this surface.
    </Alert>
  );
}
