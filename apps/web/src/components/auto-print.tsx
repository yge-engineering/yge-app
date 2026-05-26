'use client';

// AutoPrint — tiny client island that triggers window.print() on
// mount when ?autoPrint=1 is in the URL. Mounted on each printable
// bid-packet page so the bid-day cockpit can open all four in new
// tabs and each one fires its print dialog automatically.
//
// Why a small delay: window.print() before the page has fully
// painted/loaded fonts ends up printing a half-rendered DOM in some
// browsers. 250 ms is enough for the @page CSS + letterhead to
// settle.

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function AutoPrint() {
  const params = useSearchParams();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (params.get('autoPrint') !== '1') return;
    const handle = window.setTimeout(() => {
      window.print();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [params]);
  return null;
}
