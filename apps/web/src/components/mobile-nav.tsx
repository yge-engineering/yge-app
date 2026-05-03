'use client';

// Mobile nav drawer — slides in from the left on phones.
//
// Plain English: a hamburger button on the header that opens an
// overlay nav. Hidden on desktop (lg breakpoint and up). Same
// link list as the desktop sidebar.

import { useState } from 'react';
import Link from 'next/link';
import { useTranslator } from '../lib/use-translator';

interface NavLink {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

interface Props {
  groups: NavGroup[];
}

export function MobileNav({ groups }: Props) {
  const [open, setOpen] = useState(false);
  const t = useTranslator();
  return (
    <>
      <button
        type="button"
        aria-label={t('shell.openNav')}
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
      >
        {/* Hamburger icon */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M3 5h14v2H3V5zm0 4h14v2H3V9zm0 4h14v2H3v-2z" />
        </svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label={t('shell.closeNav')}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside className="relative w-72 max-w-[85%] overflow-y-auto bg-white px-4 py-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-700 text-xs font-bold text-white">
                  YGE
                </div>
                <span className="text-sm font-semibold text-gray-900">{t('shell.menu')}</span>
              </div>
              <button
                type="button"
                aria-label={t('shell.closeNav')}
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M5.7 4.3 4.3 5.7 8.6 10l-4.3 4.3 1.4 1.4L10 11.4l4.3 4.3 1.4-1.4L11.4 10l4.3-4.3-1.4-1.4L10 8.6 5.7 4.3z" />
                </svg>
              </button>
            </div>
            <nav className="space-y-5">
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {group.label}
                  </div>
                  <ul className="space-y-0.5">
                    {group.links.map((l) => (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          onClick={() => setOpen(false)}
                          className="block rounded-md px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
