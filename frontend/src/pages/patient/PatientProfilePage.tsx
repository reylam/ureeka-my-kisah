import { useState } from 'react';
import { Lock, Pencil, ShieldCheck, UserCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Badge } from '@/components/ui/Badge';
import { Field } from '@/components/forms/Field';
import { Checkbox, TextInput } from '@/components/forms/Inputs';
import { errorMessage } from '@/lib/apiClient';
import { saveOnboardingPersonal, withdrawHealthConsent } from '@/services/onboardingApi';
import { useCurrentAccount } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { formatDate } from '@/utils/date';
import { ROLE_LABEL } from '@/lib/permissions';

/**
 * Patient profile and consent.
 *
 * The part that matters here is the consent block. Health answers can be
 * withdrawn, and withdrawing clears the answers rather than only flipping a
 * flag, because a consent switch that leaves the data sitting there is not
 * consent. It is a preference.
 */
export function PatientProfilePage() {
  const account = useCurrentAccount();
  const [editing, setEditing] = useState(false);

  const [draft, setDraft] = useState(() => ({
    fullName: account?.onboarding.personal?.fullName ?? account?.name ?? '',
    phone: account?.onboarding.personal?.phone ?? '',
  }));

  if (!account) return null;
  const { personal, address, health, consent } = account.onboarding;

  const save = async () => {
    if (draft.fullName.trim().length < 2) {
      toast.error('Enter your full name.');
      return;
    }
    try {
      await saveOnboardingPersonal({
        fullName: draft.fullName.trim(),
        birthDate: personal?.birthDate ?? '',
        phone: draft.phone.trim(),
        sex: personal?.sex ?? null,
      });
      setEditing(false);
      toast.success('Profile updated.');
    } catch (cause) {
      toast.error('Could not update your profile.', errorMessage(cause));
    }
  };

  // The server clears the answers, not just the consent flag.
  const withdrawHealth = async () => {
    try {
      await withdrawHealthConsent();
      toast.success('Health answers withdrawn.', 'The answers have been cleared from your record.');
    } catch (cause) {
      toast.error('Could not withdraw your answers.', errorMessage(cause));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="My profile"
        description="Your details, your health answers, and what you have agreed to share."
      />

      <Card>
        <CardHeader
          title="About you"
          icon={<UserCircle />}
          actions={
            editing ? null : (
              <Button
                variant="outline"
                size="sm"
                leadingIcon={<Pencil className="mr-1.5 size-3.5" />}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            )
          }
        />
        <CardBody>
          {editing ? (
            <div className="space-y-4">
              <Field label="Full name" required>
                {({ id }) => (
                  <TextInput
                    id={id}
                    value={draft.fullName}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, fullName: event.target.value }))
                    }
                  />
                )}
              </Field>
              <Field label="Phone number">
                {({ id }) => (
                  <TextInput
                    id={id}
                    type="tel"
                    value={draft.phone}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, phone: event.target.value }))
                    }
                  />
                )}
              </Field>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={save}>
                  Save changes
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <dl className="divide-y divide-obsidian-100">
              <DetailRow label="Name">{personal?.fullName ?? account.name}</DetailRow>
              <DetailRow label="Email">{account.email}</DetailRow>
              <DetailRow label="Phone">{personal?.phone || 'Not provided'}</DetailRow>
              <DetailRow label="Date of birth">
                {personal?.birthDate ? formatDate(personal.birthDate) : 'Not provided'}
              </DetailRow>
              <DetailRow label="Lives in">
                {address
                  ? [address.village, address.district, address.province].filter(Boolean).join(', ')
                  : 'Not provided'}
              </DetailRow>
              <DetailRow label="Account type">{ROLE_LABEL[account.role]}</DetailRow>
              <DetailRow label="Member since">{formatDate(account.createdAt)}</DetailRow>
            </dl>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Health information"
          icon={<ShieldCheck />}
          description="What you told us during sign-up, and who can see it."
          actions={
            health?.shared ? (
              <Badge tone="info" size="sm" icon={<ShieldCheck />}>
                Shared with your care team
              </Badge>
            ) : (
              <Badge tone="inert" size="sm" icon={<Lock />}>
                Not shared
              </Badge>
            )
          }
        />
        <CardBody className="space-y-4">
          {health?.shared ? (
            <>
              <dl className="divide-y divide-obsidian-100">
                <DetailRow label="Symptoms reported">
                  {health.symptoms.length > 0 ? `${health.symptoms.length} selected` : 'None'}
                </DetailRow>
                <DetailRow label="Duration">
                  {health.symptomWeeks ? `About ${health.symptomWeeks} weeks` : 'Not given'}
                </DetailRow>
                <DetailRow label="Previous TB treatment">
                  {
                    {
                      never: 'Never treated',
                      treated: 'Treated and finished',
                      ongoing: 'Currently being treated',
                      'prefer-not-to-say': 'Preferred not to say',
                    }[health.priorTb]
                  }
                </DetailRow>
              </dl>

              <Notice tone="info" compact>
                Only health professionals assigned to your care can open these answers. No other
                patient can see them, and administrators see account details rather than your
                health record.
              </Notice>

              <Button variant="outline" size="sm" onClick={withdrawHealth}>
                Withdraw and clear my health answers
              </Button>
            </>
          ) : (
            <>
              <p className="max-w-prose text-[13px] leading-relaxed text-obsidian-600">
                You have not shared any health details. That is entirely fine: your account works
                without them. Sharing symptoms helps whoever reads your record, because symptoms
                matter more than any image.
              </p>
              <ButtonLink to="/onboarding" variant="outline" size="sm">
                Add health details
              </ButtonLink>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Consent" icon={<Lock />} />
        <CardBody className="space-y-3">
          <Checkbox
            label="My name, contact details and address may be used to manage my account and care."
            description="Required for the account to work. Contact an administrator to close your account instead."
            checked={consent?.dataUse ?? false}
            onChange={() => undefined}
            disabled
          />
          <Checkbox
            label="My health answers may be shared with the health professionals assigned to my care."
            checked={Boolean(consent?.healthInfo && health?.shared)}
            onChange={(checked) => {
              if (!checked) {
                withdrawHealth();
                return;
              }
              toast.info(
                'Add your health details first.',
                'There is nothing to share until you have answered the health questions.',
              );
            }}
          />
          {consent ? (
            <p className="border-t border-obsidian-100 pt-3 text-[12px] text-obsidian-500">
              Agreed on {formatDate(consent.acceptedAt)}.
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
