import { useEffect, useState } from 'react';
import { CheckCircle2, CircleSlash, PhoneCall } from 'lucide-react';
import type { ContactAttempt, ContactChannel, FollowUp } from '@/types/domain';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/forms/Field';
import { RadioGroup, Select, TextArea } from '@/components/forms/Inputs';
import { Notice } from '@/components/ui/Notice';
import { useDataStore } from '@/stores/dataStore';
import { toast } from '@/stores/toastStore';
import { contactChannelLabel } from '@/utils/labels';

/**
 * The three things a worker does to a follow-up besides rescheduling it:
 * record an attempt to reach the patient, close it, or declare that it cannot
 * be closed. Each is a separate deliberate action with its own required field,
 * because "unresolved" without a reason is useless to whoever picks it up next.
 */

type Outcome = ContactAttempt['outcome'];

const CHANNELS: ContactChannel[] = ['phone', 'home-visit', 'village-cadre', 'sms'];

export function ContactAttemptDialog({
  open,
  onClose,
  followUp,
}: {
  open: boolean;
  onClose: () => void;
  followUp: FollowUp;
}) {
  const logContactAttempt = useDataStore((state) => state.logContactAttempt);
  const patient = useDataStore((state) =>
    state.patients.find((item) => item.id === followUp.patientId),
  );

  const [channel, setChannel] = useState<ContactChannel>(patient?.phone ? 'phone' : 'home-visit');
  const [outcome, setOutcome] = useState<Outcome>('reached');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChannel(patient?.phone ? 'phone' : 'home-visit');
    setOutcome('reached');
    setNote('');
    setError(null);
  }, [open, patient?.phone]);

  const submit = async () => {
    // A failed attempt is only useful if it says what happened.
    if (outcome !== 'reached' && note.trim().length < 5) {
      setError('Say what happened, so the next attempt is better informed.');
      return;
    }
    try {
      await logContactAttempt(followUp.id, channel, outcome, note.trim() || null);
      toast.success(
        'Contact attempt logged.',
        outcome === 'reached'
          ? 'The follow-up is now in progress.'
          : 'The follow-up stays open for another attempt.',
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The attempt could not be saved.');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Log a contact attempt for ${followUp.code}`}
      description={
        patient
          ? `${patient.name} · ${patient.phone ?? 'no phone number on file'}`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            leadingIcon={<PhoneCall className="size-4" />}
            onClick={submit}
          >
            Log attempt
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="How did you try to reach them?" required>
          {({ id }) => (
            <Select
              id={id}
              value={channel}
              onChange={(event) => setChannel(event.target.value as ContactChannel)}
            >
              {CHANNELS.map((item) => (
                <option key={item} value={item} disabled={!patient?.phone && item === 'phone'}>
                  {contactChannelLabel[item]}
                  {!patient?.phone && item === 'phone' ? ' (no number on file)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="What happened?" required>
          {() => (
            <RadioGroup<Outcome>
              name="attempt-outcome"
              value={outcome}
              onChange={setOutcome}
              options={[
                {
                  value: 'reached',
                  label: 'Reached the patient',
                  description: 'Spoke to the patient or a household member.',
                },
                { value: 'no-answer', label: 'No answer', description: 'Nobody responded.' },
                {
                  value: 'wrong-number',
                  label: 'Wrong number',
                  description: 'Contact details need re-verifying.',
                },
                {
                  value: 'moved-away',
                  label: 'Moved away',
                  description: 'The patient no longer lives at this address.',
                },
                {
                  value: 'rescheduled',
                  label: 'Agreed a new date',
                  description: 'Reschedule the follow-up separately after logging this.',
                },
              ]}
            />
          )}
        </Field>

        <Field
          label="Note"
          error={error}
          optional={outcome === 'reached'}
          required={outcome !== 'reached'}
        >
          {({ id, describedBy, invalid }) => (
            <TextArea
              id={id}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              describedBy={describedBy}
              invalid={invalid}
              rows={3}
              placeholder="e.g. Household says he is away until Friday; cadre will pass on the message."
            />
          )}
        </Field>

        <Notice tone="demo" compact>
          This records what a worker did. The prototype does not place calls or send messages.
        </Notice>
      </div>
    </Dialog>
  );
}

export function CompleteFollowUpDialog({
  open,
  onClose,
  followUp,
}: {
  open: boolean;
  onClose: () => void;
  followUp: FollowUp;
}) {
  const completeFollowUp = useDataStore((state) => state.completeFollowUp);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (note.trim().length < 5) {
      setError('Record the outcome, even briefly. It goes on the patient timeline.');
      return;
    }
    try {
      await completeFollowUp(followUp.id, note.trim());
      toast.success(`${followUp.code} completed.`, 'The outcome was added to the patient timeline.');
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The follow-up could not be completed.');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={`Complete ${followUp.code}`}
      description="Close this task and record what the outcome was."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            leadingIcon={<CheckCircle2 className="size-4" />}
            onClick={submit}
          >
            Mark completed
          </Button>
        </>
      }
    >
      <Field label="Outcome" error={error} required>
        {({ id, describedBy, invalid }) => (
          <TextArea
            id={id}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            describedBy={describedBy}
            invalid={invalid}
            rows={4}
            placeholder="e.g. Attended the district hospital on Tuesday; sputum sample collected, result pending."
          />
        )}
      </Field>
    </Dialog>
  );
}

export function UnresolvedFollowUpDialog({
  open,
  onClose,
  followUp,
}: {
  open: boolean;
  onClose: () => void;
  followUp: FollowUp;
}) {
  const markFollowUpUnresolved = useDataStore((state) => state.markFollowUpUnresolved);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (reason.trim().length < 10) {
      setError('Explain what blocked this, in enough detail for someone else to pick it up.');
      return;
    }
    try {
      await markFollowUpUnresolved(followUp.id, reason.trim());
      toast.attention(
        `${followUp.code} marked unresolved.`,
        'It stays visible in the unresolved queue rather than disappearing.',
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The follow-up could not be updated.');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={`Mark ${followUp.code} unresolved`}
      description="Use this when the patient genuinely cannot be reached or followed up."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            leadingIcon={<CircleSlash className="size-4" />}
            onClick={submit}
          >
            Mark unresolved
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Why can this not be closed?" error={error} required>
          {({ id, describedBy, invalid }) => (
            <TextArea
              id={id}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              describedBy={describedBy}
              invalid={invalid}
              rows={4}
              placeholder="e.g. Family moved to another district for work; no working number and the new address is unknown."
            />
          )}
        </Field>
        <Notice tone="attention" compact>
          Unresolved follow-ups stay in their own queue. They are not closed and not counted as
          completed.
        </Notice>
      </div>
    </Dialog>
  );
}
