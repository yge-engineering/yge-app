'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

interface PaletteNavLink {
  label: string;
  href: string;
  /** Optional group label so we can show "Money / Bank recs" etc. */
  group?: string;
}

export interface CommandPaletteProps {
  /** Flattened list of every navigable target. */
  links: PaletteNavLink[];
}

function fuzzyScore(query: string, label: string, href: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const l = label.toLowerCase();
  const h = href.toLowerCase();
  if (l === q || h === q) return 1000;
  if (l.startsWith(q)) return 500;
  if (l.includes(q)) return 100;
  if (h.includes(q)) return 50;
  // Token-overlap fallback so "open bid tab" finds "Bid tabs".
  const queryTokens = q.split(/\s+/).filter((t) => t.length >= 2);
  let hits = 0;
  for (const t of queryTokens) {
    if (l.includes(t)) hits += 1;
  }
  if (hits === 0) return 0;
  return hits * 10;
}

export function CommandPalette({ links }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [entityLinks, setEntityLinks] = useState<PaletteNavLink[]>([]);
  const fetchedEntities = useRef(false);

  // Global ⌘-K / Ctrl-K to toggle. Esc to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isToggle =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isToggle) {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery('');
        setActiveIdx(0);
        return;
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Lazy-fetch jobs + estimate summaries on first open. The palette
  // is now a true jump-anywhere — type a project name to land on
  // that job's detail or its estimate. Entities are merged into the
  // same fuzzy-match pool as nav links and quick actions.
  useEffect(() => {
    if (!open) return;
    if (fetchedEntities.current) return;
    fetchedEntities.current = true;
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    void (async () => {
      const merged: PaletteNavLink[] = [];
      try {
        const jobsRes = await fetch(`${apiBase}/api/jobs`, { cache: 'no-store' });
        if (jobsRes.ok) {
          const body = (await jobsRes.json()) as {
            jobs: Array<{ id: string; projectName: string; ownerAgency?: string }>;
          };
          for (const j of body.jobs) {
            merged.push({
              label: j.projectName + (j.ownerAgency ? ` (${j.ownerAgency})` : ''),
              href: `/jobs/${j.id}`,
              group: 'Job',
            });
          }
        }
      } catch {
        /* swallow — palette still works without jobs */
      }
      try {
        const estRes = await fetch(`${apiBase}/api/priced-estimates`, {
          cache: 'no-store',
        });
        if (estRes.ok) {
          const body = (await estRes.json()) as {
            estimates: Array<{ id: string; projectName: string; bidStatus?: string }>;
          };
          for (const e of body.estimates) {
            merged.push({
              label:
                e.projectName +
                (e.bidStatus && e.bidStatus !== 'pursuing'
                  ? ` [${e.bidStatus}]`
                  : ''),
              href: `/estimates/${e.id}`,
              group: 'Estimate',
            });
          }
        }
      } catch {
        /* swallow */
      }
      setEntityLinks(merged);
    })();
  }, [open]);

  // Auto-focus the input each time the palette opens.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const ranked = useMemo(() => {
    const allLinks = [...links, ...entityLinks];
    const scored = allLinks
      .map((l) => ({ link: l, score: fuzzyScore(query, l.label, l.href) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 12);
  }, [links, entityLinks, query]);

  // Reset active index when results change.
  useEffect(() => {
    setActiveIdx(0);
  }, [ranked.length]);

  function go(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, ranked.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const sel = ranked[activeIdx];
      if (sel) go(sel.link.href);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-md bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 p-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Jump to… (type a page name, ↑↓ to pick, Enter to go)"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-yge-blue-500 focus:outline-none"
          />
        </div>
        {ranked.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-gray-500">
            No matches. Try a shorter keyword.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1">
            {ranked.map((r, i) => (
              <li key={r.link.href}>
                <Link
                  href={r.link.href}
                  onClick={() => go(r.link.href)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex items-center justify-between px-3 py-2 text-sm ${
                    i === activeIdx
                      ? 'bg-yge-blue-50 text-yge-blue-900'
                      : 'text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <span>
                    {r.link.group ? (
                      <span className="text-xs uppercase tracking-wide text-gray-400 mr-2">
                        {r.link.group}
                      </span>
                    ) : null}
                    {r.link.label}
                  </span>
                  <span className="font-mono text-[11px] text-gray-400">
                    {r.link.href}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between border-t border-gray-200 px-3 py-2 text-[11px] text-gray-500">
          <span>↑↓ to pick · Enter to go · Esc to close</span>
          <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </div>
      </div>
    </div>
  );
}
