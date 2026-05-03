// /terms — terms of use.
//
// Plain English: the legal page covering what users can do with the
// app. Internal-tool flavor — short, accurate, no boilerplate.

import { AppShell, Card, PageHeader } from '../../components';
import { getTranslator } from '../../lib/locale';

export default function TermsPage() {
  const t = getTranslator();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title={t('terms.title')}
          subtitle={t('terms.subtitle')}
        />

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('terms.h.who')}</h2>
          <p className="text-sm text-gray-700">{t('terms.who.body')}</p>
        </Card>

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('terms.h.confidentiality')}</h2>
          <p className="text-sm text-gray-700">{t('terms.confidentiality.body')}</p>
        </Card>

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('terms.h.acceptable')}</h2>
          <ul className="list-disc pl-5 text-sm text-gray-700">
            <li>{t('terms.acceptable.item1')}</li>
            <li>{t('terms.acceptable.item2')}</li>
            <li>{t('terms.acceptable.item3')}</li>
            <li>{t('terms.acceptable.item4')}</li>
          </ul>
        </Card>

        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('terms.h.warranty')}</h2>
          <p className="text-sm text-gray-700">{t('terms.warranty.body')}</p>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('terms.h.contact')}</h2>
          <p className="text-sm text-gray-700">
            {t('terms.contact.line1')}
            <br />
            {t('terms.contact.line2')}
          </p>
        </Card>
      </main>
    </AppShell>
  );
}
