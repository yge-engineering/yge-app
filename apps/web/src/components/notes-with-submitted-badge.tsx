// 1836: notes badge already handles [Submitted ...]. [PINNED] is handled in list cards.
// Renders notes text with [Submitted ...] markers highlighted as
// green badges.

interface Props {
  text: string;
}

export function NotesWithSubmittedBadge({ text }: Props) {
  if (!text) return null;
  const re = /\[Submitted ([^\]]+)\]/g;
  const parts: Array<{ kind: 'text' | 'submitted'; value: string }> = [];
  let lastIdx = 0;
  for (const m of text.matchAll(re)) {
    if (m.index === undefined) continue;
    if (m.index > lastIdx) parts.push({ kind: 'text', value: text.slice(lastIdx, m.index) });
    parts.push({ kind: 'submitted', value: m[1] ?? '' });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push({ kind: 'text', value: text.slice(lastIdx) });

  return (
    <p className="whitespace-pre-wrap text-xs text-gray-700">
      {parts.map((p, i) =>
        p.kind === 'submitted' ? (
          <span
            key={i}
            className="mr-1 inline-block rounded-full bg-green-100 px-2 py-0.5 align-middle text-[10px] font-semibold text-green-800"
          >
            Submitted {new Date(p.value).toLocaleDateString()}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </p>
  );
}
