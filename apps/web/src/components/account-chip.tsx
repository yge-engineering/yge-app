// Top-right account pill — shows the signed-in user + sign-out.
//
// Plain English: the little button in the corner of every page that
// says who's logged in and gives them a way out.

import Link from 'next/link';

import { Avatar } from './avatar';
import { signOut } from '../app/login/actions';
import { getCurrentUser } from '../lib/auth';
import { getTranslator } from '../lib/locale';

export function AccountChip() {
  const user = getCurrentUser();
  if (!user) return null;
  const t = getTranslator();
  return (
    <div className="flex items-center gap-3">
      <Link href="/profile" className="flex items-center gap-2 hover:opacity-75">
        <Avatar name={user.name} size="md" />
        <span className="text-right hidden sm:inline-block">
          <span className="block text-sm font-medium text-gray-900">{user.name}</span>
          <span className="block text-[11px] uppercase tracking-wide text-gray-500">{t(`accountChip.role.${user.role}`)}</span>
        </span>
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          {t('accountChip.signOut')}
        </button>
      </form>
    </div>
  );
}
