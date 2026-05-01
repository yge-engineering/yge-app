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

const TO = 'ryoung@youngge.com';
const SUBJECT_PREFIX = '[YGE App feedback] ';

export default function FeedbackPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader
          title="Feedback"
          subtitle="Spot something off? Wish a button did X instead of Y? Drop it here."
        />

        <Card className="mb-6">
          <p className="text-sm text-gray-700">
            Until we wire up a real feedback inbox, this form opens your email client with a
            pre-filled draft to <a href={`mailto:${TO}`} className="text-blue-700 hover:underline">{TO}</a>.
            Edit, send. Ryan reads every one.
          </p>
        </Card>

        <Card>
          <form action={`mailto:${TO}`} method="get" className="space-y-4">
            <FormField name="subject" label="What's it about?" required>
              <input
                id="subject"
                name="subject"
                type="text"
                required
                placeholder="Daily report — meal break warning fires too eagerly"
                defaultValue={SUBJECT_PREFIX}
                className={FORM_INPUT_CLASS}
              />
            </FormField>

            <FormField name="body" label="The detail" hint="Steps to reproduce, what you expected, what actually happened.">
              <textarea
                id="body"
                name="body"
                rows={8}
                placeholder="Was filing today's daily report on Sulphur Springs and it flagged a meal break violation even though Pat clocked out at 11:30 and back in at 12:00. That's a valid 30-minute meal break, right?"
                className={FORM_INPUT_CLASS}
              />
            </FormField>

            <button
              type="submit"
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Open in email
            </button>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-gray-400">
          Want to call instead? Ryan: 707-599-9921 · Brook: 707-499-7065
        </p>
      </main>
    </AppShell>
  );
}
