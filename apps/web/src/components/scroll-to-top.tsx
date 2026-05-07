'use client';

// ScrollToTop — floating chevron that appears once you've scrolled
// past 600px on any page. Clicking it smooth-scrolls back to the top.
// Hidden on print.

import { useEffect, useState } from 'react';

export function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    function onScroll() {
      setShow(window.scrollY > 600);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 'gt' (g then t) keyboard shortcut to jump to top from anywhere.
  // Skips when the user is typing in an input.
  useEffect(() => {
    let prefix = false;
    let prefixTimer: number | undefined;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          (t as HTMLElement).isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (prefix && e.key === 't') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        prefix = false;
        if (prefixTimer) window.clearTimeout(prefixTimer);
        return;
      }
      if (e.key === 'g') {
        prefix = true;
        if (prefixTimer) window.clearTimeout(prefixTimer);
        prefixTimer = window.setTimeout(() => {
          prefix = false;
        }, 1200);
      } else {
        // Any other key clears the prefix unless it's the 't' above.
        prefix = false;
        if (prefixTimer) window.clearTimeout(prefixTimer);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (prefixTimer) window.clearTimeout(prefixTimer);
    };
  }, []);

  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Back to top"
      aria-label="Back to top"
      className="fixed bottom-20 right-4 z-40 hidden h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 shadow-md hover:bg-gray-50 sm:flex print:hidden"
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 4l-7 7 1.4 1.4L9 7.8V16h2V7.8l4.6 4.6L17 11l-7-7z" />
      </svg>
    </button>
  );
}
