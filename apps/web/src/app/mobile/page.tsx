import Link from 'next/link';
import { AppShell } from '../../components';

export default function MobileAppPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-8">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-yge-blue-500">YGE Mobile</h1>
        <p className="mt-2 text-gray-700">
          Install on your iPhone or Android to manage bids, view jobs, and submit
          daily reports from the field. Same login as the web app.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <a
            href="https://apps.apple.com/app/id-TBD"
            className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:bg-gray-50"
          >
            <div className="text-2xl">🍎</div>
            <div className="mt-2 text-sm font-semibold">App Store · iPhone / iPad</div>
            <div className="mt-1 text-xs text-gray-500">
              Live link added once review approves the build.
            </div>
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.youngge.app"
            className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:bg-gray-50"
          >
            <div className="text-2xl">🤖</div>
            <div className="mt-2 text-sm font-semibold">Play Store · Android</div>
            <div className="mt-1 text-xs text-gray-500">
              Live link added once review approves the build.
            </div>
          </a>
        </div>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">What's in the app</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li>• Live bid pipeline + win-rate stats on the home tab</li>
          <li>• Jobs list sorted by bid-due urgency, with status pills</li>
          <li>• Estimates list with search filter + readiness pills</li>
          <li>• Tap any estimate to see bid items, edit notes, flip status</li>
          <li>• Today tab with dispatches + daily reports</li>
          <li>• Bid results screen (won/lost lifetime stats)</li>
          <li>• Offline read-cache so the app keeps working without service</li>
          <li>• English / Spanish locale</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">For internal testing</h2>
        <p className="mt-2 text-sm text-gray-700">
          While Apple / Google review the production build, internal testers can
          scan the QR code from <code>pnpm --filter @yge/mobile dev</code> with
          Expo Go on their device. This connects to whatever API URL is
          configured in the Me tab (dev or prod).
        </p>
      </main>
    </AppShell>
  );
}
