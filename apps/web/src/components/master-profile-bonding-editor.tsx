// Master-profile bonding editor.
//
// Single-row shape (one bonding profile per company). Saves the
// full bonding object via PATCH /api/master-profile.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { MasterProfile, MasterProfileBonding } from '@yge/shared';
import { useTranslator } from '../lib/use-translator';

interface Props {
  apiBaseUrl: string;
  initial?: MasterProfileBonding;
}

const EMPTY: MasterProfileBonding = {
  suretyName: '',
  singleJobLimitCents: 0,
  aggregateLimitCents: 0,
};

export function MasterProfileBondingEditor({ apiBaseUrl, initial }: Props) {
  const router = useRouter();
  const t = useTranslator();
  const [draft, setDraft] = useState<MasterProfileBonding>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial ?? EMPTY);

  function setField<K extends keyof MasterProfileBonding>(key: K, value: MasterProfileBonding[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    if (busy || !dirty) return;
    setBusy(true);
    setError(null);
    setSavedAt(null);
    try {
      const patch: Partial<MasterProfile> = { bonding: draft };
      const res = await fetch(`${apiBaseUrl}/api/master-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; issues?: unknown };
        const issuesSuffix = body.issues
          ? ` — ${JSON.stringify(body.issues).slice(0, 200)}`
          : '';
        setError((body.error ?? t('bondingProfile.errApi', { status: res.status })) + issuesSuffix);
        return;
      }
      setSavedAt(new Date().toISOString());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
        {t('bondingProfile.title')}
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('bondingProfile.surety')}>
          <input
            type="text"
            value={draft.suretyName}
            onChange={(e) => setField('suretyName', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t('bondingProfile.singleJob')}>
          <input
            type="number"
            min={0}
            value={draft.singleJobLimitCents / 100}
            onChange={(e) =>
              setField('singleJobLimitCents', Math.round(Number(e.target.value) * 100))
            }
            className={inputClass}
          />
        </Field>
        <Field label={t('bondingProfile.aggregate')}>
          <input
            type="number"
            min={0}
            value={draft.aggregateLimitCents / 100}
            onChange={(e) =>
              setField('aggregateLimitCents', Math.round(Number(e.target.value) * 100))
            }
            className={inputClass}
          />
        </Field>
        <Field label={t('bondingProfile.agentName')}>
          <input
            type="text"
            value={draft.agentName ?? ''}
            onChange={(e) => setField('agentName', e.target.value || undefined)}
            className={inputClass}
          />
        </Field>
        <Field label={t('bondingProfile.agentPhone')}>
          <input
            type="tel"
            value={draft.agentPhone ?? ''}
            onChange={(e) => setField('agentPhone', e.target.value || undefined)}
            className={inputClass}
          />
        </Field>
        <Field label={t('bondingProfile.agentEmail')}>
          <input
            type="email"
            value={draft.agentEmail ?? ''}
            onChange={(e) => setField('agentEmail', e.target.value || undefined)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label={t('bondingProfile.notes')} className="mt-3">
        <textarea
          value={draft.notes ?? ''}
          onChange={(e) => setField('notes', e.target.value || undefined)}
          className={`${inputClass} h-20 resize-y`}
          placeholder={t('bondingProfile.notesPh')}
        />
      </Field>

      {error && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || busy}
          className="rounded bg-yge-blue-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {busy ? t('bondingProfile.busy') : t('bondingProfile.action')}
        </button>
        {savedAt && (
          <span className="text-xs text-emerald-700">
            {t('bondingProfile.savedAt', { at: savedAt.replace('T', ' ').slice(0, 16) })}
          </span>
        )}
        {dirty && !busy && !savedAt && (
          <span className="text-xs text-gray-500">{t('bondingProfile.unsaved')}</span>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {t('bondingProfile.help')}
      </p>
    </section>
  );
}

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1 text-sm';

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block text-xs ${className ?? ''}`}>
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
