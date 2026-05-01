// EmptyState — what to show when a list is empty.
//
// Plain English: instead of every list page rolling its own "no data
// yet" block, use this. Bigger and friendlier than a single line of
// gray text — it explains why and gives the user a one-click action.

import Link from 'next/link';

interface Action {
  href: string;
  label: string;
  primary?: boolean;
}

interface Props {
  title: string;
  body?: string;
  actions?: Action[];
  /** Compact: smaller padding when the page is dense. */
  compact?: boolean;
}

export function EmptyState({ title, body, actions, compact }: Props) {
  return (
    <div
      className={`rounded-md border border-dashed border-gray-300 bg-white text-center text-gray-700 ${compact ? 'p-6' : 'p-12'}`}
    >
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-gray-400" aria-hidden="true">
          <path d="M3 4.5C3 3.67 3.67 3 4.5 3h11C16.33 3 17 3.67 17 4.5v11c0 .83-.67 1.5-1.5 1.5h-11C3.67 17 3 16.33 3 15.5v-11zM5 5v10h10V5H5zm2 2h6v1H7V7zm0 3h6v1H7v-1zm0 3h4v1H7v-1z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {body ? <p className="mt-1 text-sm text-gray-500">{body}</p> : null}
      {actions && actions.length > 0 ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={
                a.primary
                  ? 'rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800'
                  : 'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50'
              }
            >
              {a.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
