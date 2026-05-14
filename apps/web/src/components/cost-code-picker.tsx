// Cost-code picker — dropdown of cost codes grouped by category,
// emits a `resolved` payload (category + name + unit + unitCostCents)
// when the user picks one. Cached per-mount.

'use client';

import { useEffect, useRef, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface CostCodeRow {
  id: string;
  code: string;
  name: string;
  category: string | null;
}

interface ResolvedCode {
  code: string;
  name: string;
  category: string | null;
  unit: string;
  unitCostCents: number;
  rateSource: string | null;
  found: boolean;
}

export function CostCodePicker({
  value,
  rateType,
  onPick,
  className,
}: {
  value: string | null;
  rateType: string;
  onPick: (resolved: ResolvedCode) => void;
  className?: string;
}) {
  const [codes, setCodes] = useState<CostCodeRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (codes || loadingRef.current) return;
    loadingRef.current = true;
    fetch(`${apiBaseUrl()}/api/cost-codes`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as { costCodes: CostCodeRow[] };
        body.costCodes.sort((a, b) => {
          const ca = a.category ?? 'zzz';
          const cb = b.category ?? 'zzz';
          if (ca !== cb) return ca.localeCompare(cb);
          return a.code.localeCompare(b.code);
        });
        setCodes(body.costCodes);
      })
      .finally(() => {
        loadingRef.current = false;
      });
  }, [codes]);

  async function pick(code: string) {
    if (!code) return;
    setBusy(true);
    try {
      const res = await fetch(
        `${apiBaseUrl()}/api/cost-codes/${encodeURIComponent(code)}/resolve?rateType=${encodeURIComponent(rateType)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const body = (await res.json()) as ResolvedCode;
      onPick(body);
    } finally {
      setBusy(false);
    }
  }

  // Group codes by category for optgroups.
  const groups = new Map<string, CostCodeRow[]>();
  for (const c of codes ?? []) {
    const cat = c.category ?? 'Other';
    const arr = groups.get(cat) ?? [];
    arr.push(c);
    groups.set(cat, arr);
  }

  return (
    <select
      value={value ?? ''}
      onChange={(e) => void pick(e.target.value)}
      disabled={busy || !codes}
      className={
        className ??
        'w-32 rounded border border-gray-300 bg-white px-1 py-0.5 font-mono text-[11px]'
      }
    >
      <option value="">{codes ? '— pick code —' : 'Loading…'}</option>
      {[...groups.entries()].map(([cat, list]) => (
        <optgroup key={cat} label={cat}>
          {list.map((c) => (
            <option key={c.id} value={c.code}>
              {c.code} — {c.name.slice(0, 60)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
