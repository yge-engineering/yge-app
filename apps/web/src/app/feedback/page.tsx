// /feedback — quick gripe / wishlist page for the YGE team.
//
// Plain English: when something feels off or you wish a button did
// something different, drop a note here. We don't have a backend
// for this yet, so the form just opens your email client with a
// pre-filled draft to ryoung@youngge.com. Once we wire up the API,
// the form will save directly.

import {
  AppShell,
  Card,
  FORM_INPUT_CLASS,
  FormField,
  PageHeader,
} from '../../components';
import { getTranslator } from '../../lib/locale';

const TO = 'ryoung@youngge.com';
const SUBJECT_PREFIX = '[YGE App feedback] ';

export default function FeedbackPage() {
  const t = getTranslator();
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader
          title={t('feedback.title')}
          subtitle={t('feedback.subtitle')}
        />

        <Card className="mb-6">
          <p className="text-sm text-gray-700">
            {(() => {
              // Split-and-fill: keep the mailto link as a real <a/> while
              // pulling surrounding text from the localized template.
              const tpl = t('feedback.intro', { to: '__TO__' });
              const [pre, post] = tpl.split('__TO__');
              return (
                <>
                  {pre}
                  <a href={`mailto:${TO}`} className="text-blue-700 hover:underline">{TO}</a>
                  {post}
                </>
              );
            })()}
          </p>
        </Card>

        <Card>
          <form action={`mailto:${TO}`} method="get" className="space-y-4">
            <FormField name="subject" label={t('feedback.subjectLabel')} required>
              <input
                id="subject"
                name="subject"
                type="text"
                required
                placeholder={t('feedback.subjectPlaceholder')}
                defaultValue={SUBJECT_PREFIX}
                className={FORM_INPUT_CLASS}
              />
            </FormField>

            <FormField name="body" label={t('feedback.bodyLabel')} hint={t('feedback.bodyHint')}>
              <textarea
                id="body"
                name="body"
                rows={8}
                placeholder={t('feedback.bodyPlaceholder')}
                className={FORM_INPUT_CLASS}
              />
            </FormField>

            <button
              type="submit"
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              {t('feedback.openInEmail')}
            </button>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-gray-400">
          {t('feedback.callFooter')}
        </p>
      </main>
    </AppShell>
  );
}
