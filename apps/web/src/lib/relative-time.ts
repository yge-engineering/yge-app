/** "Just now" / "5m ago" / "Yesterday" / "3d ago" / "2w ago" / "5mo ago" / "3y ago".
 *  Falls back to the original ISO string when unparseable. */
export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  if (diff < 0) return 'in the future';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const now = new Date();
    const then = new Date(t);
    if (
      now.getFullYear() === then.getFullYear() &&
      now.getMonth() === then.getMonth() &&
      now.getDate() === then.getDate()
    ) {
      return `${hours}h ago`;
    }
    return 'Yesterday';
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}
