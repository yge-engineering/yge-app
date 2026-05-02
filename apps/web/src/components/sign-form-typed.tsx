// Typed-signature affirmation form.
//
// Client island for /sign/[id]. Captures the signer's typed name +
// affirmation checkbox, hashes the disclosure text in-browser, and
// POSTs to /api/signatures/:id/sign. The route fills in IP / UA
// from the request edge.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { sha256Hex } from '@yge/shared';

interface Props {
  apiBaseUrl: string;
  signatureId: string;
  /** Name on the signature row — typed name must match for submit. */
  expectedSignerName: string;
  disclosureText: string;
  affirmationText: string;
}

export function SignFormTyped({
  apiBaseUrl,
  signatureId,
  expectedSignerName,
  disclosureText,
  affirmationText,
}: Props) {
  const router = useRouter();
  const [typedName, setTypedName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const namesMatch =
    typedName.trim().toLowerCase() === expectedSignerName.trim().toLowerCase();
  const ready = namesMatch && agreed;

  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const now = new Date();
      const disclosureSha256 = await sha256Hex(disclosureText);
      const res = await fetch(
        `${apiBaseUrl}/api/signatures/${signatureId}/sign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consent: {
              agreedAt: now.toISOString(),
              disclosureSha256,
              affirmationText,
            },
            authContext: {
              authMethod: 'IN_PERSON',
              authenticatedAt: now.toISOString(),
              userAgent: navigator.userAgent,
              // IP is captured server-side from the request edge.
            },
            signedAt: now.toISOString(),
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `API returned ${res.status}`);
        setBusy(null != null ? false : false);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-md border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Affirm
      </h2>

      <label className="mb-3 block text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          Type your full name as it appears on the document
        </span>
        <input
          type="text"
          autoComplete="off"
          required
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          placeholder={expectedSignerName}
        />
        <span
          className={`mt-1 block text-xs ${
            typedName.length === 0
              ? 'text-gray-500'
              : namesMatch
                ? 'text-emerald-700'
                : 'text-amber-700'
          }`}
        >
          {typedName.length === 0
            ? `Expected: ${expectedSignerName}`
            : namesMatch
              ? '✓ Matches the name on this signature row'
              : `Doesn't match "${expectedSignerName}". Capitalization is ignored.`}
        </span>
      </label>

      <label className="mb-4 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-gray-800">{affirmationText}</span>
      </label>

      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!ready || busy}
        className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Signing…' : 'Sign'}
      </button>

      <p className="mt-3 text-xs text-gray-500">
        Clicking Sign records your typed name, the affirmation above,
        the SHA-256 of the disclosure text you saw, your user agent, your
        IP address (captured server-side), and the signing timestamp.
      </p>
    </form>
  );
}
