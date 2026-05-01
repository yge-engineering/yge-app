// Root / — redirects to /dashboard.
//
// Plain English: with the sidebar nav living in AppShell, the old
// "directory of every module" page is no longer needed at the root.
// Anyone hitting / gets bounced to the morning glance.

import { redirect } from 'next/navigation';

export default function Home(): never {
  redirect('/dashboard');
}
