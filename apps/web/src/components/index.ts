// Barrel re-exports for the web app's reusable components.
//
// Plain English: lets pages do
//   import { AppShell, Card, DataTable, Money } from '../../components';
// instead of one import line per file.

export { AppShell } from './app-shell';
export { AccountChip } from './account-chip';
export { Button, LinkButton } from './button';
export { Card, CardHeader } from './card';
export { DataTable } from './data-table';
export { DateAgo } from './date-ago';
export { EmptyState } from './empty-state';
export { FormField, FORM_INPUT_CLASS } from './form-field';
export { GettingStartedBanner } from './getting-started-banner';
export { KeyboardShortcuts } from './keyboard-shortcuts';
export { LongText } from './long-text';
export { MobileNav } from './mobile-nav';
export { Money } from './money';
export { PageHeader } from './page-header';
export { RecentActivity } from './recent-activity';
export { RoleBadge } from './role-badge';
export { StatusPill, jobStatusTone, workflowStatusTone } from './status-pill';
export { Toggle } from './toggle';
export { Toaster, showToast } from './toast';
export { Modal } from './modal';
export { ConfirmButton } from './confirm-button';
export { Tile, type TileTone } from './tile';
export { Breadcrumbs, type Crumb } from './breadcrumbs';
export { DescriptionList } from './description-list';
export { Spinner } from './spinner';
export { Avatar } from './avatar';
