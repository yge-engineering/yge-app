// DIR rate manual-import form.
//
// Pastes a proposals[] JSON body, POSTs to /api/dir-rate-sync/
// manual-import, and reports back the run id + per-row counts.
// Lives at the bottom of /dir-rate-sync as the operator-driven
// alternative to the (future) automated scraper.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';

interface Props {
  apiBaseUrl: string;
}

interface ImportResponse {
  run: { id: string; status: string };
  created: number;
  failed: number;
  proposalIds: string[];
}

const SAMPLE_BODY = `{
  "summary": "DIR Aug-22-2026 semi-annual posting — Shasta + Tehama crafts I monitor",
  "sourceReference": "https://www.dir.ca.gov/OPRL/2026-2/PWD/index.htm",
  "proposals": [
    {
      "rationale": "OE Group 4 — Shasta. Basic up $1.50, fringe unchanged.",
      "proposedRate": {
        "classification": "OPERATING_ENGINEER_GROUP_4",
        "county": "Shasta",
        "effectiveDate": "2026-08-22",
        "basicHourlyCents": 6021,
        "healthAndWelfareCents": 1235,
        "pensionCents": 980,
        "vacationHolidayCents": 410,
        "trainingCents": 110,
        "otherFringeCents": 0,
        "sourceUrl": "https://www.dir.ca.gov/OPRL/2026-2/PWD/index.htm"
      }
    }
  ]
}`;

export function DirRateManualImportForm({ apiBaseUrl }: Props) {
  const router = useRouter();
  const t = useTranslator();
  const [bodyText, setBodyText] = useState(SAMPLE_BODY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyText);
    } catch (err) {
      setError(t('dirImport.errParse', { message: err instanceof Error ? err.message : String(err) }));
      setBusy(false);
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/dir-rate-sync/manual-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; issues?: unknown };
        const issues = body.issues ? ` — ${JSON.stringify(body.issues).slice(0, 300)}` : '';
        setError((body.error ?? t('dirImport.errStatus', { status: res.status })) + issues);
        return;
      }
      const json = (await res.json()) as ImportResponse;
      setResult(json);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <header className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t('dirImport.title')}
        </h2>
        <p className="mt-1 text-xs text-gray-600">
          {t('dirImport.intro')}
        </p>
      </header>

      <textarea
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        rows={16}
        className="w-full rounded border border-gray-300 px-3 py-2 text-xs font-mono"
        spellCheck={false}
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {busy ? t('dirImport.busy') : t('dirImport.action')}
        </button>
        <button
          type="button"
          onClick={() => setBodyText(SAMPLE_BODY)}
          className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
        >
          {t('dirImport.reset')}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
          {t('dirImport.resultLeader')} <code className="font-mono">{result.run.id}</code> {t('dirImport.resultStatus', { status: result.run.status })}
          {' '}{result.created === 1 ? t('dirImport.resultOne') : t('dirImport.resultMany', { count: result.created })}
          {result.failed > 0 && t('dirImport.resultFailed', { count: result.failed })}
          {t('dirImport.resultDone')}
          {result.proposalIds.length > 0 && (
            <span> {t('dirImport.resultScroll')}</span>
          )}
        </div>
      )}
    </section>
  );
}
