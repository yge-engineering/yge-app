import { AppShell, PageHeader } from '../../components';
import { FavoritesPanel } from './favorites-panel';

export default function FavoritesPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Favorites" subtitle="Bookmark any page in the app. Stored in your browser; nothing leaves your machine." />
        <FavoritesPanel />
      </main>
    </AppShell>
  );
}
