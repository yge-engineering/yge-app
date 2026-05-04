// Master-profile officers editor.
//
// Client island. List-of-rows shape: add row (new officer), edit any
// row inline, delete row. Saves the full officers array via PATCH
// /api/master-profile so the audit trail captures the before/after
// snapshots cleanly.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { newOfficerId, type MasterProfile, type MasterProfileOfficer } from '@yge/shared';
import { useTranslator } from '../lib/use-translator';

interface Props {
  apiBaseUrl: string;
  initial: MasterProfileOfficer[];
}

export function MasterProfileOfficersEditor({ apiBaseUrl, initial }: Props) {
  const router = useRouter();
  const t = useTranslator();
  const [draft, setDraft] = useState<MasterProfileOfficer[]>(initial);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  function setRow(index: number, patch: Partial<MasterProfileOfficer>) {
    setDraft((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    setDraft((rows) => rows.filter((_, i) => i !== index));
  }

  function addRow() {
    setDraft((rows) => [
      ...rows,
      {
        id: newOfficerId(),
        name: '',
        title: '',
        roleKey: '',
        phone: '',
        email: '',
      },
    ]);
  }

  async function save() {
    if (busy || !dirty) return;
    setBusy(true);
    setError(null);
    setSavedAt(null);
    try {
      const patch: Partial<MasterProfile> = { officers: draft };
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
        setError((body.error ?? t('officersEditor.errApi', { status: res.status })) + issuesSuffix);
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
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t('officersEditor.title', { count: draft.length })}
        </h2>
        <button
          type="button"
          onClick={addRow}
          className="rounded border border-yge-blue-500 px-2 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
        >
          {t('officersEditor.add')}
        </button>
      </header>

      {draft.length === 0 ? (
        <p className="text-sm text-gray-500">{t('officersEditor.empty')}</p>
      ) : (
        <div className="space-y-3">
          {draft.map((o, i) => (
            <div key={o.id} className="rounded border border-gray-200 bg-gray-50 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label={t('officersEditor.lblName')}>
                  <input
                    type="text"
                    value={o.name}
                    onChange={(e) => setRow(i, { name: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('officersEditor.lblTitle')}>
                  <input
                    type="text"
                    value={o.title}
                    onChange={(e) => setRow(i, { title: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field
                  label={t('officersEditor.lblRoleKey')}
                  hint={t('officersEditor.hintRoleKey')}
                >
                  <input
                    type="text"
                    value={o.roleKey}
                    onChange={(e) => setRow(i, { roleKey: e.target.value.toLowerCase() })}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('officersEditor.lblPhone')}>
                  <input
                    type="tel"
                    value={o.phone}
                    onChange={(e) => setRow(i, { phone: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('officersEditor.lblEmail')}>
                  <input
                    type="email"
                    value={o.email}
                    onChange={(e) => setRow(i, { email: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('officersEditor.lblOwn')}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={o.ownershipPercent ?? ''}
                    onChange={(e) =>
                      setRow(i, {
                        ownershipPercent: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono text-[11px] text-gray-500">{o.id}</span>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50"
                >
                  {t('officersEditor.remove')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
          {busy ? t('officersEditor.busy') : t('officersEditor.action')}
        </button>
        {savedAt && (
          <span className="text-xs text-emerald-700">
            {t('officersEditor.savedAt', { at: savedAt.replace('T', ' ').slice(0, 16) })}
          </span>
        )}
        {dirty && !busy && !savedAt && (
          <span className="text-xs text-gray-500">{t('officersEditor.unsaved')}</span>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {t('officersEditor.help')}
      </p>
    </section>
  );
}

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1 text-sm';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-gray-500">{hint}</span>}
    </label>
  );
}
