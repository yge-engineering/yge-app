// /dashboard/lite — simplified morning glance.
//
// User-directed: "dashboard… way too busy". The full /dashboard is
// a 1500-line page packed with tiles. This page hand-picks four
// self-fetching tiles for a calm morning view:
//
//   1. AR aging tile (money on the way)
//   2. CPR due tile (compliance burden for the week)
//   3. Inbox triage tile (overnight email categories)
//   4. Morning briefing tile (curated headlines)
//
// Plus a "Switch to full dashboard" link for the deep view.

import Link from 'next/link';

import { AppShell, PageHeader } from '../../../components';
import { ArAgingTile } from '../../../components/ar-aging-tile';
import { CoiAgingTile } from '../../../components/coi-aging-tile';
import { CprDueTile } from '../../../components/cpr-due-tile';
import {
  DashboardViewPrefEnforcer,
  DashboardViewPrefSetter,
} from '../../../components/dashboard-view-pref';
import { MorningBriefingTile } from '../../../components/morning-briefing-tile';
import { UpcomingBidsTile } from '../../../components/upcoming-bids-tile';
import { ArCollectionsTile } from '../../../components/ar-collections-tile';
import { RecentDraftsTile } from '../../../components/recent-drafts-tile';
import { LostBidsTile } from '../../../components/lost-bids-tile';
import { ComparablesSeedStatusTile } from '../../../components/comparables-seed-status-tile';
import { ExtensionSnapshotStatusTile } from '../../../components/extension-snapshot-status-tile';
import { MasterProfileCompletenessTile } from '../../../components/master-profile-completeness-tile';
import { MasterProfileExpiriesTile } from '../../../components/master-profile-expiries-tile';
import { PdfFormsReviewTile } from '../../../components/pdf-forms-review-tile';

export default function DashboardLitePage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-6 sm:p-8">
        <PageHeader
          title="Dashboard"
          subtitle="Simplified morning view. Four tiles. Need everything? Open the full board."
        />

        <DashboardViewPrefEnforcer hereIs="lite" />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-gray-600">Showing the simplified board.</span>
          <div className="flex items-center gap-2">
            <DashboardViewPrefSetter value="lite" label="Make this the default" />
            <Link
              href="/dashboard"
              className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-semibold text-yge-blue-500 hover:bg-yge-blue-50"
            >
              Switch to full dashboard →
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <MasterProfileExpiriesTile />
          <MasterProfileCompletenessTile />
          <ExtensionSnapshotStatusTile />
          <UpcomingBidsTile />
          <RecentDraftsTile />
          <LostBidsTile />
          <ComparablesSeedStatusTile />
          <PdfFormsReviewTile />
          <ArCollectionsTile />

          <div className="grid gap-4 lg:grid-cols-2">
            <ArAgingTile />
            <CprDueTile />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <CoiAgingTile />
            <MorningBriefingTile />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
