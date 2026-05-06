'use client';

// Sub-bid leveling worksheet client component.
//
// Plain English: the estimator types in a scope (e.g. "Striping &
// TC"), then adds competing quotes from each sub. The page recomputes
// deltas vs low bid + highlights the leader. "Award" copies the
// winner's name + amount to clipboard so the estimator can paste
// into the §4104 sub list editor.
//
// State persists on the estimate row via debounced PATCH /api/priced-
// estimates/:id. Server-rendered initial state means a page reload
// (or device switch) doesn't lose work. Save indicator surfaces the
// last persist timestamp.

import { useEffect, useRef, useState } from 'react';

interface CompetingBid {
  id: string;
  contractorName: string;
  cslbLicense: string;
  bidAmountCents: number;
  notes: string;
}
interface ScopeRow {
  id: string;
  scope: string;
  bids: CompetingBid[];
  awardedBidId?: string;
}

interface Props {
  estimateId: string;
  initialScopes: ScopeRow[];
  apiBaseUrl: string;
}

function newId(): string {
  return `sl-${Math.floor(Math.random() * 0xffffff).toString(16)}`;
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function dollarsToCents(s: string): number {
  const cleaned = s.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function SubLevelingClient({
  estimateId,
  initialScopes,
  apiBaseUrl,
}: Props) {
  const [scopes, setScopes] = useState<ScopeRow[]>(initialScopes);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJsonRef = useRef<string>(JSON.stringify(initialScopes));

  // Debounced auto-save to /api/priced-estimates/:id whenever scopes
  // change. 600 ms feels responsive without slamming the disk.
  useEffect(() => {
    const json = JSON.stringify(scopes);
    if (json === lastSavedJsonRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/priced-estimates/${encodeURIComponent(estimateId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subLeveling: scopes }),
          },
        );
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Save failed (${res.status}): ${text.slice(0, 200)}`);
        }
        lastSavedJsonRef.current = json;
        setSavedAt(new Date().toISOString());
        setSaveError(null);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Save failed');
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [scopes, apiBaseUrl, estimateId]);

  function addScope() {
    setScopes((prev) => [
      ...prev,
      { id: newId(), scope: '', bids: [], awardedBidId: undefined },
    ]);
  }
  function deleteScope(id: string) {
    if (
      !window.confirm('Delete this scope and all its quotes? Cannot be undone.')
    )
      return;
    setScopes((prev) => prev.filter((s) => s.id !== id));
  }
  function updateScope(id: string, patch: Partial<ScopeRow>) {
    setScopes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }
  function addBid(scopeId: string) {
    setScopes((prev) =>
      prev.map((s) =>
        s.id === scopeId
          ? {
              ...s,
              bids: [
                ...s.bids,
                {
                  id: newId(),
                  contractorName: '',
                  cslbLicense: '',
                  bidAmountCents: 0,
                  notes: '',
                },
              ],
            }
          : s,
      ),
    );
  }
  function updateBid(
    scopeId: string,
    bidId: string,
    patch: Partial<CompetingBid>,
  ) {
    setScopes((prev) =>
      prev.map((s) =>
        s.id === scopeId
          ? {
              ...s,
              bids: s.bids.map((b) => (b.id === bidId ? { ...b, ...patch } : b)),
            }
          : s,
      ),
    );
  }
  function removeBid(scopeId: string, bidId: string) {
    setScopes((prev) =>
      prev.map((s) =>
        s.id === scopeId
          ? {
              ...s,
              bids: s.bids.filter((b) => b.id !== bidId),
              awardedBidId:
                s.awardedBidId === bidId ? undefined : s.awardedBidId,
            }
          : s,
      ),
    );
  }
  async function award(scope: ScopeRow, bid: CompetingBid) {
    updateScope(scope.id, { awardedBidId: bid.id });
    // Copy a §4104 sub-list-friendly line to the clipboard.
    const line =
      `${bid.contractorName}` +
      (bid.cslbLicense ? ` (CSLB ${bid.cslbLicense})` : '') +
      ` — ${scope.scope || '(scope)'} — ${fmtMoney(bid.bidAmountCents)}`;
    try {
      await navigator.clipboard.writeText(line);
    } catch {
      // best-effort
    }
  }

  if (scopes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <h2 className="text-base font-semibold text-gray-900">
          No scopes yet
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Start with one scope (e.g. <em>Striping & TC</em>), then add the
          quotes you've collected from each sub.
        </p>
        <button
          type="button"
          onClick={addScope}
          className="mt-4 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
        >
          + Add first scope
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {scopes.map((scope) => {
        const lowBid =
          scope.bids.length === 0
            ? null
            : scope.bids.reduce((lo, b) =>
                b.bidAmountCents > 0 &&
                (lo.bidAmountCents === 0 || b.bidAmountCents < lo.bidAmountCents)
                  ? b
                  : lo,
              );
        return (
          <section
            key={scope.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                value={scope.scope}
                onChange={(e) =>
                  updateScope(scope.id, { scope: e.target.value })
                }
                placeholder="Scope (e.g. Striping & TC)"
                className="flex-1 rounded border border-gray-300 px-3 py-2 text-base font-semibold"
              />
              <button
                type="button"
                onClick={() => deleteScope(scope.id)}
                className="text-xs font-medium text-red-700 hover:underline"
              >
                Delete scope
              </button>
            </div>

            {scope.bids.length === 0 ? (
              <p className="mt-3 text-xs text-gray-500">
                No quotes yet. Add each sub's bid below.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Sub</th>
                      <th className="px-3 py-2">CSLB #</th>
                      <th className="px-3 py-2 text-right">Bid</th>
                      <th className="px-3 py-2 text-right">Δ vs low</th>
                      <th className="px-3 py-2">Notes</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {scope.bids.map((bid) => {
                      const isLow =
                        lowBid !== null &&
                        bid.bidAmountCents > 0 &&
                        bid.bidAmountCents === lowBid.bidAmountCents;
                      const delta =
                        lowBid !== null && lowBid.bidAmountCents > 0
                          ? bid.bidAmountCents - lowBid.bidAmountCents
                          : 0;
                      const isAwarded = scope.awardedBidId === bid.id;
                      return (
                        <tr
                          key={bid.id}
                          className={
                            isAwarded
                              ? 'bg-green-50'
                              : isLow
                                ? 'bg-amber-50'
                                : ''
                          }
                        >
                          <td className="px-3 py-2">
                            <input
                              value={bid.contractorName}
                              onChange={(e) =>
                                updateBid(scope.id, bid.id, {
                                  contractorName: e.target.value,
                                })
                              }
                              placeholder="Contractor name"
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={bid.cslbLicense}
                              onChange={(e) =>
                                updateBid(scope.id, bid.id, {
                                  cslbLicense: e.target.value,
                                })
                              }
                              placeholder="123456"
                              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm font-mono"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              value={
                                bid.bidAmountCents === 0
                                  ? ''
                                  : (bid.bidAmountCents / 100).toFixed(2)
                              }
                              onChange={(e) =>
                                updateBid(scope.id, bid.id, {
                                  bidAmountCents: dollarsToCents(e.target.value),
                                })
                              }
                              placeholder="0.00"
                              className="w-32 rounded border border-gray-300 px-2 py-1 text-right font-mono text-sm"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {bid.bidAmountCents === 0 ? (
                              <span className="text-gray-400">—</span>
                            ) : delta === 0 ? (
                              <span className="text-amber-700">LOW</span>
                            ) : (
                              <span className="text-red-700">
                                +{fmtMoney(delta)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={bid.notes}
                              onChange={(e) =>
                                updateBid(scope.id, bid.id, {
                                  notes: e.target.value,
                                })
                              }
                              placeholder="exclusions / inclusions"
                              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-xs">
                            <button
                              type="button"
                              onClick={() => void award(scope, bid)}
                              className={`rounded px-2 py-1 font-semibold ${
                                isAwarded
                                  ? 'bg-green-700 text-white'
                                  : 'border border-blue-700 text-blue-700 hover:bg-blue-50'
                              }`}
                            >
                              {isAwarded ? '✓ Awarded' : 'Award + copy'}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeBid(scope.id, bid.id)}
                              className="ml-2 font-medium text-gray-500 hover:text-red-700"
                              title="Remove this quote"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => addBid(scope.id)}
                className="font-medium text-blue-700 hover:underline"
              >
                + Add quote for this scope
              </button>
              {scope.awardedBidId && (
                <span className="text-green-700">
                  Awarded line copied to clipboard. Paste into the §4104 sub
                  list at /estimates/{estimateId}/sub-list.
                </span>
              )}
            </div>
          </section>
        );
      })}

      <button
        type="button"
        onClick={addScope}
        className="rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
      >
        + Add another scope
      </button>

      <p className="text-xs text-gray-500">
        Auto-saves to the estimate row. Use Award + copy to paste the winner
        into the §4104 sub list.
        {saveError && (
          <span className="ml-2 text-red-700">⚠ {saveError}</span>
        )}
        {!saveError && savedAt && (
          <span className="ml-2 text-green-700">
            ✓ Saved {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
      </p>
    </div>
  );
}
