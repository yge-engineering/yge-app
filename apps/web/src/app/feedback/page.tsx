import { AppShell, PageHeader } from '../../components';
import { FeedbackForm } from './feedback-form';

export default function FeedbackPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader title="Feedback" subtitle="Bug reports, feature requests, or anything that bugs you about the app." />
        <FeedbackForm />
      </main>
    </AppShell>
  );
}
