'use client';

// Long-text renderer — for RFI questions/answers, daily-report scope,
// AP invoice notes, etc.
//
// Plain English: takes a string with newlines and renders it with the
// paragraph breaks preserved. Auto-linkifies URLs. No markdown
// dependency — just whitespace-aware HTML escaping with a couple of
// regex passes. Trade-off: simpler, no external lib, but no headings/
// bullets/etc. For most user-typed prose, that's fine.
//
// Client component so it can be re-exported through the components
// barrel without dragging `next/headers` into client bundles.

import { useTranslator } from '../lib/use-translator';

interface Props {
  text: string;
  /** Max chars before showing a 'Show more' toggle. Pass 0 to disable. */
  truncate?: number;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const URL_RE = /(https?:\/\/[^\s<]+)/g;

function linkify(escaped: string): string {
  return escaped.replace(URL_RE, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-700 underline hover:no-underline">${url}</a>`;
  });
}

export function LongText({ text, truncate = 0 }: Props) {
  const t = useTranslator();
  if (!text || text.trim().length === 0) {
    return <span className="text-xs italic text-gray-400">{t('longText.blank')}</span>;
  }

  const display = truncate > 0 && text.length > truncate ? text.slice(0, truncate) + '…' : text;

  // Split on blank lines into paragraphs; within a paragraph, treat single
  // newlines as soft line breaks.
  const paragraphs = display.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const html = paragraphs
    .map((p) => {
      const escaped = escapeHtml(p).replace(/\n/g, '<br />');
      return `<p>${linkify(escaped)}</p>`;
    })
    .join('');

  return (
    <div
      className="space-y-2 text-sm leading-relaxed text-gray-800 [&_p]:m-0"
      // Safe: escaped + only allowing our own anchor tag from linkify
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
