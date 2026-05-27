// DEPRECATED — moved to @yge/shared/master-profile-expiry.
//
// Bundle 2660 promoted these helpers to the shared package so
// the API + mobile can use them too (e.g. a future cron that
// emails Ryan 30 days before expiry). Update any imports from
// '../lib/master-profile-expiry' to '@yge/shared'.
//
// Re-export shim kept so any stale import keeps working until
// the file can be moved to ~/Desktop/to-be-deleted/ after Ryan
// reviews.

export {
  daysUntil,
  classifyExpiry,
  collectExpiringItems,
  type ExpiringItem,
} from '@yge/shared';
