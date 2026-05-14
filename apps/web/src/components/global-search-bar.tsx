// Tiny "jump to search" widget. Sits on the dashboard.
// Routes to /imported-estimates/search?q=… on Enter.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function GlobalSearchBar() {
  const [q, setQ] = useState('');
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term.length === 0) return;
    router.push(`/imported-estimates/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <form
      onSubmit={submit}
      className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm"
    >
      <span className="text-xs text-gray-500">🔍</span>
      <input
        type="search"
        placeholder="Search bids, customers, vendors, cost codes…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-gray-400"
      />
      <button
        type="submit"
        className="rounded bg-yge-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-yge-blue-700"
      >
        Search
      </button>
    </form>
  );
}
