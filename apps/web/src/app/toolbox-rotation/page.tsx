'use client';

// /toolbox-rotation — pick the next toolbox-talk topic based on the
// crew's recent history.
//
// The recommender lives in @yge/shared; this page is a thin client
// wrapper that lets the foreman record the last few weeks of talks
// (topic + date) and see the ranked recommendation. Persists the
// history in localStorage so reloads survive — no DB until a real
// "Toolbox attendance" entity ships.

import { useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_TOPIC_LIBRARY,
  recommendToolboxRotation,
  type ToolboxTalkHistoryEntry,
} from '@yge/shared';

import { AppShell, PageHeader } from '../../components';

const STORAGE_KEY = 'yge.toolboxRotation.history.v1';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadHistory(): ToolboxTalkHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is ToolboxTalkHistoryEntry =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as { topicId?: unknown }).topicId === 'string' &&
        typeof (r as { date?: unknown }).date === 'string',
    );
  } catch {
    return [];
  }
}

function saveHistory(rows: ToolboxTalkHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // localStorage full / disabled — non-fatal.
  }
}

export default function ToolboxRotationPage() {
  const [history, setHistory] = useState<ToolboxTalkHistoryEntry[]>([]);
  const [newTopicId, setNewTopicId] = useState<string>(DEFAULT_TOPIC_LIBRARY[0]!.id);
  const [newDate, setNewDate] = useState(todayIso());

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const recs = useMemo(
    () =>
      recommendToolboxRotation({
        history,
        asOfDate: todayIso(),
      }),
    [history],
  );

  function addEntry() {
    if (!newTopicId || !newDate) return;
    setHistory((rows) => [...rows, { topicId: newTopicId, date: newDate }]);
  }

  function removeEntry(idx: number) {
    setHistory((rows) => rows.filter((_, i) => i !== idx));
  }

  function clearHistory() {
    if (typeof window !== 'undefined' && !window.confirm('Clear all history?')) return;
    setHistory([]);
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl p-8">
        <PageHeader
          title="Toolbox talk rotation"
          subtitle="Pick the next safety topic for the crew based on what's gone the longest without coverage. Cal/OSHA-mandated topics get a boost when they're 11+ months stale. Heat illness gets boosted May–Sep."
        />

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Add a past talk
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="font-medium text-gray-700">Topic</span>
              <select
                value={newTopicId}
                onChange={(e) => setNewTopicId(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm"
              >
                {DEFAULT_TOPIC_LIBRARY.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium text-gray-700">Date given</span>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm"
              />
            </label>
            <div className="flex items-end">
              <button
                onClick={addEntry}
                className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700"
              >
                + Add to history
              </button>
            </div>
          </div>

          {history.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  History ({history.length} entries)
                </h4>
                <button
                  onClick={clearHistory}
                  className="text-xs text-red-700 hover:underline"
                >
                  Clear all
                </button>
              </div>
              <ul className="mt-2 divide-y divide-gray-100 text-sm">
                {history
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((row, i) => {
                    const topic = DEFAULT_TOPIC_LIBRARY.find((t) => t.id === row.topicId);
                    return (
                      <li key={`${row.topicId}-${row.date}-${i}`} className="flex items-center justify-between py-2">
                        <span>
                          <span className="font-medium">{row.date}</span> · {topic?.title ?? row.topicId}
                        </span>
                        <button
                          onClick={() => removeEntry(history.indexOf(row))}
                          className="text-xs text-gray-500 hover:text-red-700 hover:underline"
                        >
                          remove
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Recommended next topics
          </h3>
          <ol className="mt-3 space-y-2 text-sm">
            {recs.slice(0, 5).map((rec, idx) => {
              const isTop = idx === 0;
              return (
                <li
                  key={rec.topic.id}
                  className={`rounded-md border p-4 ${isTop ? 'border-yge-blue-300 bg-yge-blue-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {idx + 1}. {rec.topic.title}
                      </div>
                      <div className="mt-1 text-xs italic text-gray-600">{rec.reason}</div>
                    </div>
                    <div className="text-xs tabular-nums text-gray-500">
                      {Number.isFinite(rec.daysSinceLast)
                        ? `${rec.daysSinceLast}d`
                        : 'never'}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </AppShell>
  );
}
