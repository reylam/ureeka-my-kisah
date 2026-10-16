import { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import type { ClinicalReview, Screening } from '@/types/domain';
import { Button } from '@/components/ui/Button';
import { Field, Fieldset } from '@/components/forms/Field';
import { RadioGroup, TextArea } from '@/components/forms/Inputs';
import { Notice } from '@/components/ui/Notice';
import { errorMessage } from '@/lib/apiClient';
import { useCurrentUser } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { toast } from '@/stores/toastStore';
import { userRoleLabel } from '@/utils/labels';
import { users } from '@/data/users';
import { formatDateTime } from '@/utils/date';

/**
 * Clinical review sign-off.
 *
 * The screening output is never the end of the workflow. A person has to look
 * at the image and decide. Only roles with `canReview` can submit here; others
 * see why they cannot, rather than a disabled button with no explanation.
 */

type Agreement = ClinicalReview['agreement'];
type Decision = ClinicalReview['decision'];

export function ReviewForm({
  screening,
  onReviewed,
}: {
  screening: Screening;
  onReviewed?: () => void;
}) {
  const user = useCurrentUser();
  const submitReview = useDataStore((state) => state.submitReview);

  const [agreement, setAgreement] = useState<Agreement>('agrees');
  const [decision, setDecision] = useState<Decision>(
    screening.analysis?.outcome === 'flagged-for-review'
      ? 'refer'
      : screening.analysis?.outcome === 'inconclusive'
        ? 'repeat-image'
        : screening.analysis
          ? 'no-action'
          : 'observe',
  );
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* Already reviewed: show the signed-off record instead of the form. */
  if (screening.review) {
    const reviewer = users.find((u) => u.id === screening.review!.reviewerId);
    // Without model output there is nothing to agree with, so the same three
    // stored values read as the reviewer's own conclusion about the image.
    const agreementText: Record<Agreement, string> = screening.analysis
      ? {
          agrees: 'Agreed with the screening output',
          disagrees: 'Disagreed with the screening output',
          'needs-more-data': 'Could not conclude without more data',
        }
      : {
          agrees: 'Reviewed the image, no concern raised',
          disagrees: 'Reviewed the image, concern raised',
          'needs-more-data': 'Could not conclude without more data',
        };
    const decisionText: Record<Decision, string> = {
      refer: 'Refer for diagnostic testing',
      'repeat-image': 'Repeat the radiograph',
      observe: 'Observe and recheck',
      'no-action': 'No further action',
    };

    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-md border border-complete-300/70 bg-complete-50 px-3.5 py-3">
          <ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-complete-700" />
          <div className="min-w-0 text-[13px]">
            <p className="font-medium text-complete-800">
              Reviewed by {reviewer?.name ?? 'a clinician'}
            </p>
            <p className="mt-0.5 text-obsidian-600">
              {formatDateTime(screening.review.reviewedAt)}
              {reviewer ? ` · ${userRoleLabel[reviewer.role]}` : ''}
            </p>
          </div>
        </div>

        <dl className="divide-y divide-obsidian-100 text-[13px]">
          <div className="grid grid-cols-[8rem_1fr] gap-3 py-2">
            <dt className="text-obsidian-500">Assessment</dt>
            <dd className="text-obsidian-900">{agreementText[screening.review.agreement]}</dd>
          </div>
          <div className="grid grid-cols-[8rem_1fr] gap-3 py-2">
            <dt className="text-obsidian-500">Decision</dt>
            <dd className="text-obsidian-900">{decisionText[screening.review.decision]}</dd>
          </div>
          <div className="grid grid-cols-[8rem_1fr] gap-3 py-2">
            <dt className="text-obsidian-500">Notes</dt>
            <dd className="leading-relaxed text-obsidian-700">{screening.review.notes}</dd>
          </div>
        </dl>
      </div>
    );
  }

  /* A draft has not been submitted, so there is nothing to sign off yet. */
  if (screening.status === 'draft') {
    return (
      <Notice tone="demo" compact>
        This record is still a draft. Finish and submit it before it can be reviewed.
      </Notice>
    );
  }

  /* Wrong role. */
  if (!user?.canReview) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-md border border-obsidian-200 bg-obsidian-50 px-3.5 py-3">
          <Lock aria-hidden className="mt-px size-4 shrink-0 text-obsidian-400" />
          <div className="min-w-0 text-[13px]">
            <p className="font-medium text-obsidian-900">Awaiting a clinical reviewer</p>
            <p className="mt-0.5 leading-relaxed text-obsidian-600">
              Your role ({user ? userRoleLabel[user.role] : 'unknown'}) records screenings but does
              not sign off reviews. A nurse or physician needs to look at this image.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (notes.trim().length < 10) {
      setError('Add a short note explaining your read. At least 10 characters.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await submitReview(screening.id, { agreement, decision, notes: notes.trim() });
      toast.success('Review recorded.', 'The screening record has been signed off.');
      onReviewed?.();
    } catch (cause) {
      // The server re-checks that this person may sign off and that the record is open.
      toast.error('The review could not be recorded.', errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Fieldset legend="Your read of the image">
        <RadioGroup<Agreement>
          name="agreement"
          value={agreement}
          onChange={setAgreement}
          options={[
            {
              value: 'agrees',
              label: screening.analysis ? 'Consistent with the screening output' : 'No concern on this image',
              description: screening.analysis
                ? 'What I see matches what the model reported.'
                : 'I looked at the image and nothing needs escalating.',
            },
            {
              value: 'disagrees',
              label: screening.analysis ? 'Not consistent with the screening output' : 'Concern on this image',
              description: screening.analysis
                ? 'My read differs. The record should follow my assessment.'
                : 'I see something that needs follow-up.',
            },
            {
              value: 'needs-more-data',
              label: 'Cannot conclude from this image',
              description: 'Quality or positioning prevents a reliable read.',
            },
          ]}
        />
      </Fieldset>

      <Fieldset legend="What happens next" hint="This drives the record’s workflow state.">
        <RadioGroup<Decision>
          name="decision"
          value={decision}
          onChange={setDecision}
          options={[
            {
              value: 'refer',
              label: 'Refer for diagnostic testing',
              description: 'Escalate to a facility that can confirm or exclude TB.',
            },
            {
              value: 'repeat-image',
              label: 'Repeat the radiograph',
              description: 'Bring the patient back for a better image.',
            },
            {
              value: 'observe',
              label: 'Observe and recheck',
              description: 'Keep the record open and schedule a symptom recheck.',
            },
            {
              value: 'no-action',
              label: 'No further action',
              description: 'Close the record. The patient is advised to return if symptoms change.',
            },
          ]}
        />
      </Fieldset>

      <Field label="Review note" error={error} required>
        {({ id, describedBy, invalid }) => (
          <TextArea
            id={id}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            describedBy={describedBy}
            invalid={invalid}
            rows={3}
            placeholder="What you saw, and why you reached this decision."
          />
        )}
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-obsidian-500">
          Signing as <span className="font-medium text-obsidian-800">{user.name}</span> ·{' '}
          {userRoleLabel[user.role]}
        </p>
        <Button
          variant="primary"
          loading={saving}
          leadingIcon={<ShieldCheck className="size-4" />}
          onClick={() => void handleSubmit()}
        >
          Record review
        </Button>
      </div>
    </div>
  );
}
