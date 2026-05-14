import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

// Auto-generated list of every page known to /admin/grand-index as of bundle 2114.
const URLS: string[] = [
  '/', '/about', '/at-a-glance', '/changelog', '/favorites', '/feedback', '/help', '/help/cheatsheet', '/help/getting-started', '/help/glossary',
  '/keyboard-shortcuts', '/portfolio', '/quick-tools', '/reports', '/search', '/sitemap',
  '/dashboard/all', '/dashboard/last-7-days', '/dashboard/morning-briefing', '/dashboard/stats-index', '/dashboard/this-month', '/dashboard/this-quarter', '/dashboard/today', '/dashboard/yesterday',
  '/admin', '/admin/all-detail-views', '/admin/api-endpoints', '/admin/api-test', '/admin/audit-log-preview', '/admin/audit-recent', '/admin/bond-capacity', '/admin/build-info',
  '/admin/cheatsheet', '/admin/cleanup-index', '/admin/cleanup-progress', '/admin/company-info', '/admin/cron-list', '/admin/cross-tabs-index', '/admin/csv-exports', '/admin/csv-imports',
  '/admin/data-health', '/admin/data-overview', '/admin/data-overview-detail', '/admin/data-quality', '/admin/data-quality-counts', '/admin/data-quality-grade', '/admin/data-quality-hub',
  '/admin/data-status', '/admin/data-summary', '/admin/everything', '/admin/everything-v2', '/admin/excel-import', '/admin/feature-flags', '/admin/feature-overview', '/admin/grand-index',
  '/admin/gusto', '/admin/health', '/admin/health-check', '/admin/health-extended', '/admin/help', '/admin/integrations', '/admin/inverses-hub', '/admin/inverses-hub-v2',
  '/admin/master-data-cards', '/admin/milestones', '/admin/onboarding', '/admin/onboarding-status', '/admin/page-count', '/admin/portal-users', '/admin/print-friendly', '/admin/quick-links',
  '/admin/quick-look', '/admin/recent-activity', '/admin/release-history', '/admin/scheduled-tasks', '/admin/section-index', '/admin/server-time', '/admin/setup-wizard',
  '/admin/stats-and-detail-pairs', '/admin/system-info', '/admin/system-status', '/admin/url-map', '/admin/whoami',
  '/jobs', '/jobs/active', '/jobs/active-by-agency', '/jobs/active-by-year', '/jobs/all-by-month', '/jobs/archived', '/jobs/awarded', '/jobs/awarded-revenue', '/jobs/bid-submitted',
  '/jobs/board', '/jobs/budget-actual', '/jobs/by-day-of-week', '/jobs/by-location', '/jobs/by-location-detail', '/jobs/by-month', '/jobs/by-month-detail', '/jobs/by-owner-agency',
  '/jobs/by-owner-agency-detail', '/jobs/by-owner-agency-stats', '/jobs/by-quarter', '/jobs/by-quarter-detail', '/jobs/by-rate-type', '/jobs/by-rate-type-detail', '/jobs/by-status',
  '/jobs/by-status-and-year', '/jobs/by-status-detail', '/jobs/by-status-rate-type', '/jobs/by-status-stats', '/jobs/by-year', '/jobs/by-year-detail', '/jobs/closed', '/jobs/closed-by-year',
  '/jobs/lost', '/jobs/missing-job-number', '/jobs/missing-location', '/jobs/missing-owner-agency', '/jobs/missing-rate-type', '/jobs/missing-status', '/jobs/no-bid', '/jobs/prospect',
  '/jobs/pursuing', '/jobs/recent', '/jobs/statuses', '/jobs/this-month', '/jobs/this-quarter', '/jobs/this-quarter-stats', '/jobs/this-week', '/jobs/this-year', '/jobs/this-year-stats',
  '/jobs/today', '/jobs/with-job-number', '/jobs/with-location', '/jobs/with-owner-agency', '/jobs/with-rate-type', '/jobs/with-status',
  '/bid-results', '/bid-results/all-by-month', '/bid-results/apparent-lows', '/bid-results/biggest-wins', '/bid-results/by-agency', '/bid-results/by-agency-detail', '/bid-results/by-agency-stats',
  '/bid-results/by-amount-bucket', '/bid-results/by-bidder-count', '/bid-results/by-day-of-week', '/bid-results/by-month', '/bid-results/by-month-detail', '/bid-results/by-outcome-and-year',
  '/bid-results/by-outcome-stats', '/bid-results/by-quarter', '/bid-results/by-quarter-detail', '/bid-results/by-rank', '/bid-results/by-year', '/bid-results/by-year-detail',
  '/bid-results/closest-misses', '/bid-results/competitor-detail', '/bid-results/import', '/bid-results/last-30-days', '/bid-results/losses', '/bid-results/no-award', '/bid-results/outcomes',
  '/bid-results/tbd', '/bid-results/this-month-stats', '/bid-results/this-quarter', '/bid-results/this-week', '/bid-results/this-year', '/bid-results/this-year-stats', '/bid-results/today',
  '/bid-results/top-competitors', '/bid-results/wins', '/bid-results/with-multiple-bidders', '/bid-results/won-no-job',
  '/customers', '/customers/by-city', '/customers/by-city-detail', '/customers/by-kind', '/customers/by-kind-and-state', '/customers/by-kind-detail', '/customers/by-kind-stats',
  '/customers/by-payment-terms', '/customers/by-payment-terms-detail', '/customers/by-state', '/customers/by-state-and-kind', '/customers/by-state-detail', '/customers/by-zip',
  '/customers/by-zip-detail', '/customers/email-list', '/customers/missing-billing-address', '/customers/missing-email', '/customers/missing-phone', '/customers/missing-state',
  '/customers/newsletter', '/customers/no-contact-info', '/customers/not-on-hold', '/customers/on-hold', '/customers/recent', '/customers/tax-exempt', '/customers/this-month',
  '/customers/this-quarter', '/customers/this-week', '/customers/this-year', '/customers/today', '/customers/with-billing-address', '/customers/with-email', '/customers/with-phone',
  '/customers/with-state',
  '/vendors', '/vendors/by-city', '/vendors/by-city-detail', '/vendors/by-kind', '/vendors/by-kind-detail', '/vendors/by-kind-stats', '/vendors/by-state', '/vendors/by-state-and-kind',
  '/vendors/by-state-detail', '/vendors/by-zip', '/vendors/by-zip-detail', '/vendors/coi-aging', '/vendors/email-list', '/vendors/missing-billing-address', '/vendors/missing-email',
  '/vendors/missing-phone', '/vendors/missing-state', '/vendors/newsletter', '/vendors/no-contact-info', '/vendors/recent', '/vendors/scorecard', '/vendors/this-month', '/vendors/this-quarter',
  '/vendors/this-week', '/vendors/this-year', '/vendors/today', '/vendors/with-billing-address', '/vendors/with-coi', '/vendors/with-email', '/vendors/with-phone', '/vendors/with-state',
  '/employees/active', '/employees/by-classification', '/employees/by-classification-detail', '/employees/by-classification-stats', '/employees/by-status', '/employees/by-status-detail',
  '/employees/by-tenure', '/employees/inactive', '/employees/missing-classification', '/employees/missing-hire-date', '/employees/recent', '/employees/this-month', '/employees/this-quarter',
  '/employees/this-week', '/employees/this-year', '/employees/today', '/employees/with-classification', '/employees/with-hire-date',
  '/materials', '/materials/by-category', '/materials/by-category-detail', '/materials/by-category-stats', '/materials/recent',
  '/equipment-rates', '/equipment-rates/by-kind-detail', '/equipment-rates/owned-vs-rental', '/equipment-rates/recent',
  '/labor-rates', '/labor-rates/by-classification', '/labor-rates/by-classification-detail', '/labor-rates/by-rate-type', '/labor-rates/recent',
  '/cost-codes', '/cost-codes/by-prefix', '/cost-codes/by-prefix-detail', '/cost-codes/by-prefix-stats', '/cost-codes/recent',
  '/imported-estimates', '/imported-estimates/by-rate-type', '/imported-estimates/by-rate-type-detail', '/imported-estimates/recent', '/imported-estimates/this-month',
  '/imported-estimates/this-quarter', '/imported-estimates/this-year', '/imported-estimates/today',
  '/daily-reports', '/daily-reports/import', '/daily-reports/recent', '/daily-reports/this-month', '/daily-reports/this-year', '/daily-reports/today',
];

export default function EverythingV2Page() {
  requirePermission('audit:view');
  const sorted = [...new Set(URLS)].sort();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Every page v2" subtitle={`Refreshed flat alphabetical list of every URL in the app. ${sorted.length} total.`} />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
          {sorted.map((href) => (
            <li key={href} className="px-3 py-1.5">
              <Link href={href} className="font-mono text-xs text-yge-blue-700 hover:underline">{href}</Link>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
