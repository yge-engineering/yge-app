// Account editor.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  accountTypeLabel,
  defaultTypeForNumber,
  type Account,
  type AccountType,
} from '@yge/shared';

const TYPES: AccountType[] = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'COGS',
  'EXPENSE',
  'OTHER_INCOME',
  'OTHER_EXPENSE',
];

interface FormState {
  number: string;
  name: string;
  type: AccountType;
  parentNumber: string;
  active: boolean;
  description: string;
}

function defaults(a?: Account): FormState {
  return {
    number: a?.number ?? '',
    name: a?.name ?? '',
    type: a?.type ?? 'EXPENSE',
    parentNumber: a?.parentNumber ?? '',
    active: a?.active ?? true,
    description: a?.description ?? '',
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function AccountEditor({
  mode,
  account,
}: {
  mode: 'create' | 'edit';
  account?: Account;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaults(account));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track whether the user manually picked a type so number-driven
  // defaults don't overwrite their choice.
  const [typeManual, setTypeManual] = useState(mode === 'edit');

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function onNumberChange(v: string) {
    setForm((f) => {
      const next: FormState = { ...f, number: v };
      if (!typeManual && /^\d+$/.test(v)) {
        next.type = defaultTypeForNumber(v);
      }
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const trim = (s: string) => (s.trim().length === 0 ? undefined : s.trim());
    const body: Record<string, unknown> = {
      number: form.number.trim(),
      name: form.name.trim(),
      type: form.type,
      parentNumber: trim(form.parentNumber),
      active: form.active,
      description: trim(form.description),
    };
    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/coa`
          : `${apiBaseUrl()}/api/coa/${account!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { account: Account };
      if (mode === 'create') {
        router.push(`/coa/${json.account.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Section title="Account">
        <Field label="Number (4-6 digits)" required>
          <input
            className={inputCls}
            value={form.number}
            onChange={(e) => onNumberChange(e.target.value)}
            placeholder="51100"
            required
          />
        </Field>
        <Field label="Name" required>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="Direct Labor — Wages"
            required
          />
        </Field>
        <Field label="Type">
          <select
            className={inputCls}
            value={form.type}
            onChange={(e) => {
              setTypeManual(true);
              setField('type', e.target.value as AccountType);
            }}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {accountTypeLabel(t)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Parent #">
          <input
            className={inputCls}
            value={form.parentNumber}
            onChange={(e) => setField('parentNumber', e.target.value)}
            placeholder="51000"
          />
        </Field>
        <Field label="Active">
          <Checkbox
            checked={form.active}
            onChange={(b) => setField('active', b)}
            label="Visible in pickers (uncheck to retire)"
          />
        </Field>
        <Field label="Description" full>
          <textarea
            className={`${inputCls} min-h-[60px]`}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
          />
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : mode === 'create' ? 'Create account' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  'w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-sm ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-yge-blue-500 focus:ring-yge-blue-500"
      />
      {label}
    </label>
  );
}
