// Top-right account pill — shows the signed-in user + sign-out.
//
// Plain English: the little button in the corner of every page that
// says who's logged in and gives them a way out.

import Link from 'next/link';

import { signOut } from '../app/login/actions';
import { getCurrentUser } from '../lib/auth';

function roleLabel(role: 'PRESIDENT' | 'VP' | 'OFFICE' | 'FOREMAN' | 'CREW'): string {
  switch (role) {
    case 'PRESIDENT': return 'President';
    case 'VP': return 'VP';
    case 'OFFICE': return 'Office';
    case 'FOREMAN': return 'Foreman';
    case 'CREW': return 'Crew';
  }
}

export function AccountChip() {
  const user = getCurrentUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-3">
      <Link href="/profile" className="text-right hover:opacity-75">
        <div className="text-sm font-medium text-gray-900">{user.name}</div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500">{roleLabel(user.role)}</div>
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
