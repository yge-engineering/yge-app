import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';
import { PortfolioPanels } from './portfolio-panels';

export default function PortfolioPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Portfolio" subtitle="High-level picture of YGE's customers, vendors, jobs, and lifetime wins." />
        <PortfolioPanels />
      </main>
    </AppShell>
  );
}
