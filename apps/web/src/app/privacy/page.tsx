// /privacy — privacy notice.
//
// Plain English: what data the app collects, how it's stored, and
// what we do with it. Internal-tool tone — short, honest.

import { AppShell, Card, PageHeader } from '../../components';
import { getTranslator } from '../../lib/locale';

export default function PrivacyPage() {
  const t = getTranslator();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title={t('privacy.title')}
          subtitle={t('privacy.subtitle')}
        />

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('privacy.h.collect')}</h2>
          <ul className="list-disc pl-5 text-sm text-gray-700">
            <li>{t('privacy.collect.item1')}</li>
            <li>{t('privacy.collect.item2')}</li>
            <li>{t('privacy.collect.item3')}</li>
            <li>{t('privacy.collect.item4')}</li>
          </ul>
        </Card>

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('privacy.h.lives')}</h2>
          <p className="text-sm text-gray-700">{t('privacy.lives.body')}</p>
        </Card>

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('privacy.h.retention')}</h2>
          <p className="text-sm text-gray-700">{t('privacy.retention.body')}</p>
        </Card>

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('privacy.h.access')}</h2>
          <p className="text-sm text-gray-700">{t('privacy.access.body')}</p>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('privacy.h.tracking')}</h2>
          <p className="text-sm text-gray-700">{t('privacy.tracking.body')}</p>
        </Card>
      </main>
    </AppShell>
  );
}
