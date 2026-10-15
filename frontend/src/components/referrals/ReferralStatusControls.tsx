import { useState } from 'react';
import { ArrowRight, CheckCircle2, CircleDashed, History } from 'lucide-react';
import type { Referral, ReferralStatus } from '@/types/domain';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/forms/Field';
import { Select, TextArea } from '@/components/forms/Inputs';
import { ReferralStatusBadge } from '@/components/ui/StatusBadge';
import { useDataStore } from '@/stores/dataStore';
import { toast } from '@/stores/toastStore';
import { referralStatusLabel } from '@/utils/labels';
import { formatDateTime } from '@/utils/date';
import { users } from '@/data/users';

/**
 * Referral status controls.
 *
 * The lifecycle is mostly linear, so the common case is a single "advance to
 * the next step" button. Anything out of sequence (closing early, correcting a
 * mistake) goes through the explicit picker, which requires a note so the
 * history explains itself later.
 */

const FLOW: ReferralStatus[] = [
  'draft',
  'pending',
  'referred',
  'appointment-scheduled',
  'attended',
  'followup-required',
  'closed',
];

/** Plain-language description of what advancing actually means. */
const ADVANCE_COPY: Partial<Record<ReferralStatus, string>> = {
  draft: 'Submit this referral so it appears in the register as pending.',
  pending: 'Mark as sent to the destination facility.',
  referred: 'Record that an appointment has been booked.',
  'appointment-scheduled': 'Record that the patient attended.',
  attended: 'Open a follow-up because a result is still outstanding.',
  'followup-required': 'Close this referral episode.',
};

export function nextStatus(current: ReferralStatus): ReferralStatus | null {
  const index = FLOW.indexOf(current);
  if (index < 0 || index >= FLOW.length - 1) return null;
  return FLOW[index + 1]!;
}

export function ReferralStatusControls({
  referral,
  compact = false,
}: {
  referral: Referral;
  compact?: boolean;
}) {
  const setReferralStatus = useDataStore((state) => state.setReferralStatus);
  const [changeOpen, setChangeOpen] = useState(false);
  const [target, setTarget] = useState<ReferralStatus>(referral.status);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const advance = nextStatus(referral.status);

  const applyChange = () => {
    if (target === referral.status) {
      setError('Pick a status different from the current one.');
      return;
    }
    if (note.trim().length < 5) {
      setError('Add a short note explaining the change.');
      return;
    }
    setReferralStatus(referral.id, target, note.trim());
    setChangeOpen(false);
    setNote('');
    setError(null);
    toast.success(
      `${referral.code} set to ${referralStatusLabel[target].toLowerCase()}.`,
    );
  };

  return (
    <>
      <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-3'}>
        {!compact && advance ? (
          <p className="text-[13px] leading-relaxed text-obsidian-600">
            {ADVANCE_COPY[referral.status]}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {advance ? (
            <Button
              size={compact ? 'sm' : 'md'}
              variant="primary"
              trailingIcon={<ArrowRight className="size-4" />}
              onClick={() => {
                setReferralStatus(referral.id, advance);
                toast.success(
                  `${referral.code} set to ${referralStatusLabel[advance].toLowerCase()}.`,
                );
              }}
            >
              {referral.status === 'draft' ? 'Submit referral' : referralStatusLabel[advance]}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-obsidian-500">
              <CheckCircle2 aria-hidden className="size-4 text-complete-700" />
              This referral is closed.
            </span>
          )}

          <Button
            size={compact ? 'sm' : 'md'}
            variant="outline"
            leadingIcon={<CircleDashed className="size-4" />}
            onClick={() => {
              setTarget(referral.status);
              setChangeOpen(true);
            }}
          >
            Change status
          </Button>
        </div>
      </div>

      <Dialog
        open={changeOpen}
        onClose={() => setChangeOpen(false)}
        title={`Change status of ${referral.code}`}
        description="Out-of-sequence changes need a reason so the history stays readable."
        footer={
          <>
            <Button variant="ghost" onClick={() => setChangeOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={applyChange}>
              Apply change
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-md border border-obsidian-200 bg-obsidian-50 px-3 py-2.5">
            <span className="text-xs text-obsidian-500">Currently</span>
            <ReferralStatusBadge status={referral.status} size="sm" />
          </div>

          <Field label="New status" required>
            {({ id }) => (
              <Select
                id={id}
                value={target}
                onChange={(event) => setTarget(event.target.value as ReferralStatus)}
              >
                {FLOW.map((status) => (
                  <option key={status} value={status}>
                    {referralStatusLabel[status]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Reason for the change" error={error} required>
            {({ id, describedBy, invalid }) => (
              <TextArea
                id={id}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                describedBy={describedBy}
                invalid={invalid}
                rows={3}
                placeholder="e.g. Facility called to say the appointment was cancelled."
              />
            )}
          </Field>
        </div>
      </Dialog>
    </>
  );
}

/** Chronological status trail for a referral. */
export function ReferralHistory({ referral }: { referral: Referral }) {
  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
        <History aria-hidden className="size-3" />
        Status history
      </h3>
      <ol className="mt-2.5 space-y-2.5">
        {[...referral.history].reverse().map((event) => (
          <li key={event.id} className="flex gap-2.5">
            <span
              aria-hidden
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-obsidian-300"
            />
            <div className="min-w-0">
              <p className="text-[13px] text-obsidian-900">
                {event.from
                  ? `${referralStatusLabel[event.from]} to ${referralStatusLabel[event.to]}`
                  : referralStatusLabel[event.to]}
              </p>
              {event.note ? (
                <p className="mt-0.5 text-xs leading-relaxed text-obsidian-600">{event.note}</p>
              ) : null}
              <p className="mt-0.5 text-[11px] text-obsidian-400">
                {formatDateTime(event.at)} ·{' '}
                {users.find((user) => user.id === event.actorId)?.name ?? 'Unknown user'}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
