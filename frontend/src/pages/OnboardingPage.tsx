import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Lock } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { Field } from '@/components/forms/Field';
import { Checkbox, RadioGroup, Select, TextArea, TextInput } from '@/components/forms/Inputs';
import { Stepper, type Step } from '@/components/forms/Stepper';
import { useAuthStore, useCurrentAccount } from '@/stores/authStore';
import { useAccountStore } from '@/stores/accountStore';
import type { OnboardingHealth } from '@/types/account';
import { DISTRICTS, PROVINCE, VILLAGES, type District } from '@/data/geography';
import { toast } from '@/stores/toastStore';
import { formatDate } from '@/utils/date';

/**
 * Patient onboarding.
 *
 * Four steps, and only the first is compulsory. Step 3 asks about symptoms and
 * TB history, which is the most sensitive thing this product ever collects, so
 * it can be skipped outright and the reason it is being asked sits above the
 * questions rather than in a policy page nobody opens.
 *
 * Progress is written to the account on every "continue", not held in this
 * component, so closing the tab halfway through loses nothing. The route guard
 * sends an unfinished patient back here, and the wizard resumes where they
 * stopped.
 */

const STEPS: Step[] = [
  { id: 'personal', label: 'About you', hint: 'Name, date of birth, contact' },
  { id: 'address', label: 'Where you live', hint: 'For nearby facilities' },
  { id: 'health', label: 'Health details', hint: 'Optional' },
  { id: 'consent', label: 'Review', hint: 'Check and confirm' },
];

const SYMPTOM_OPTIONS = [
  { id: 'cough', label: 'Cough that will not go away' },
  { id: 'blood', label: 'Coughing up blood' },
  { id: 'night-sweats', label: 'Night sweats' },
  { id: 'weight-loss', label: 'Losing weight without trying' },
  { id: 'fever', label: 'Fever' },
  { id: 'chest-pain', label: 'Chest pain' },
  { id: 'fatigue', label: 'Unusual tiredness' },
  { id: 'appetite', label: 'Loss of appetite' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const account = useCurrentAccount();
  const signOut = useAuthStore((state) => state.signOut);
  const store = useAccountStore();

  const [step, setStep] = useState(() => Math.min(account?.onboarding.step ?? 0, 3));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [personal, setPersonal] = useState(() => ({
    fullName: account?.onboarding.personal?.fullName ?? account?.name ?? '',
    birthDate: account?.onboarding.personal?.birthDate ?? '',
    phone: account?.onboarding.personal?.phone ?? '',
    sex: account?.onboarding.personal?.sex ?? null,
  }));

  const [address, setAddress] = useState(() => ({
    province: PROVINCE,
    district: account?.onboarding.address?.district ?? '',
    village: account?.onboarding.address?.village ?? '',
    addressLine: account?.onboarding.address?.addressLine ?? '',
  }));

  const [health, setHealth] = useState<OnboardingHealth>(() => ({
    symptoms: account?.onboarding.health?.symptoms ?? [],
    symptomWeeks: account?.onboarding.health?.symptomWeeks ?? null,
    priorTb: account?.onboarding.health?.priorTb ?? 'never',
    householdContact: account?.onboarding.health?.householdContact ?? null,
    notes: account?.onboarding.health?.notes ?? '',
    shared: account?.onboarding.health?.shared ?? true,
  }));

  const [consent, setConsent] = useState({
    dataUse: account?.onboarding.consent?.dataUse ?? false,
    healthInfo: account?.onboarding.consent?.healthInfo ?? false,
  });

  const villages = useMemo(
    () => (address.district ? (VILLAGES[address.district as District] ?? []) : []),
    [address.district],
  );

  // Non-patients have no onboarding; send them to their own workspace.
  if (!account) return <Navigate to="/login" replace />;
  if (account.role !== 'patient') return <Navigate to="/app" replace />;
  if (account.onboarding.completedAt) return <Navigate to="/me" replace />;

  const validateStep = (): boolean => {
    const next: Record<string, string> = {};

    if (step === 0) {
      if (personal.fullName.trim().length < 2) next.fullName = 'Enter your full name.';
      if (!personal.birthDate) next.birthDate = 'Enter your date of birth.';
      else if (new Date(personal.birthDate) > new Date())
        next.birthDate = 'That date is in the future.';
      if (personal.phone.replace(/\D/g, '').length < 8)
        next.phone = 'Enter a phone number we could reach you on.';
    }

    if (step === 1) {
      if (!address.district) next.district = 'Choose your district.';
      if (!address.village) next.village = 'Choose your village or sub-district.';
    }

    if (step === 3 && !consent.dataUse) {
      next.consent = 'We need your agreement on the basics before the account can be used.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep()) return;

    if (step === 0) {
      store.saveOnboardingPersonal(account.id, {
        fullName: personal.fullName.trim(),
        birthDate: personal.birthDate,
        phone: personal.phone.trim(),
        sex: personal.sex,
      });
    }
    if (step === 1) store.saveOnboardingAddress(account.id, { ...address });
    if (step === 2) store.saveOnboardingHealth(account.id, health);

    if (step === 3) {
      store.completeOnboarding(account.id, {
        acceptedAt: new Date().toISOString(),
        dataUse: consent.dataUse,
        // Only meaningful if they actually shared anything in step 3.
        healthInfo: health.shared ? consent.healthInfo : false,
      });
      toast.success('You are all set.');
      navigate('/me', { replace: true });
      return;
    }

    setStep(step + 1);
  };

  const skipHealth = () => {
    const declined: OnboardingHealth = {
      symptoms: [],
      symptomWeeks: null,
      priorTb: 'prefer-not-to-say',
      householdContact: null,
      notes: '',
      shared: false,
    };
    setHealth(declined);
    store.saveOnboardingHealth(account.id, declined);
    setStep(3);
  };

  return (
    <div className="min-h-dvh bg-cloud">
      <header className="border-b border-obsidian-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo tone="dark" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              signOut();
              navigate('/', { replace: true });
            }}
          >
            Finish later
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-xl font-semibold text-obsidian-950">
          Welcome, {account.name.split(' ')[0]}
        </h1>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-obsidian-600">
          A few details so your records are complete and we can point you to facilities near you.
          You can change any of this later from your profile.
        </p>

        <Stepper
          steps={STEPS}
          current={step}
          completed={Array.from({ length: step }, (_, index) => index)}
          onStepClick={(index) => {
            // Backwards only. Jumping ahead would skip validation.
            if (index < step) setStep(index);
          }}
          className="mt-7"
        />

        <Card className="mt-6">
          {/* ── Step 1 ── */}
          {step === 0 ? (
            <>
              <CardHeader title="About you" description="Required, so your record is identifiable." />
              <CardBody className="space-y-4">
                <Field label="Full name" error={errors.fullName ?? null} required>
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      value={personal.fullName}
                      onChange={(event) =>
                        setPersonal((c) => ({ ...c, fullName: event.target.value }))
                      }
                      describedBy={describedBy}
                      invalid={invalid}
                      autoComplete="name"
                    />
                  )}
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Date of birth"
                    hint="Used to work out your age band, which affects screening guidance."
                    error={errors.birthDate ?? null}
                    required
                  >
                    {({ id, describedBy, invalid }) => (
                      <TextInput
                        id={id}
                        type="date"
                        value={personal.birthDate}
                        onChange={(event) =>
                          setPersonal((c) => ({ ...c, birthDate: event.target.value }))
                        }
                        describedBy={describedBy}
                        invalid={invalid}
                      />
                    )}
                  </Field>

                  <Field label="Phone number" error={errors.phone ?? null} required>
                    {({ id, describedBy, invalid }) => (
                      <TextInput
                        id={id}
                        type="tel"
                        value={personal.phone}
                        onChange={(event) =>
                          setPersonal((c) => ({ ...c, phone: event.target.value }))
                        }
                        describedBy={describedBy}
                        invalid={invalid}
                        autoComplete="tel"
                        placeholder="0812-0000-0000"
                      />
                    )}
                  </Field>
                </div>

                <Field
                  label="Sex"
                  hint="Optional. TB presents differently between groups, so it helps the people reading your record."
                >
                  {() => (
                    <RadioGroup
                      name="sex"
                      value={personal.sex}
                      onChange={(value) => setPersonal((c) => ({ ...c, sex: value }))}
                      options={[
                        { value: 'female', label: 'Female' },
                        { value: 'male', label: 'Male' },
                      ]}
                    />
                  )}
                </Field>
              </CardBody>
            </>
          ) : null}

          {/* ── Step 2 ── */}
          {step === 1 ? (
            <>
              <CardHeader
                title="Where you live"
                description="Only as much as is needed to show you the nearest facilities."
              />
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Province">
                    {({ id }) => <TextInput id={id} value={address.province} readOnly disabled />}
                  </Field>

                  <Field label="District" error={errors.district ?? null} required>
                    {({ id, describedBy, invalid }) => (
                      <Select
                        id={id}
                        value={address.district}
                        onChange={(event) =>
                          setAddress((c) => ({ ...c, district: event.target.value, village: '' }))
                        }
                        describedBy={describedBy}
                        invalid={invalid}
                      >
                        <option value="">Choose a district</option>
                        {DISTRICTS.map((district) => (
                          <option key={district} value={district}>
                            {district}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>

                <Field label="Village or sub-district" error={errors.village ?? null} required>
                  {({ id, describedBy, invalid }) => (
                    <Select
                      id={id}
                      value={address.village}
                      onChange={(event) =>
                        setAddress((c) => ({ ...c, village: event.target.value }))
                      }
                      describedBy={describedBy}
                      invalid={invalid}
                      disabled={!address.district}
                    >
                      <option value="">
                        {address.district ? 'Choose a village' : 'Choose a district first'}
                      </option>
                      {villages.map((village) => (
                        <option key={village} value={village}>
                          {village}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Field
                  label="Street address"
                  hint="Optional. Only needed if a health worker may have to visit you."
                >
                  {({ id }) => (
                    <TextInput
                      id={id}
                      value={address.addressLine}
                      onChange={(event) =>
                        setAddress((c) => ({ ...c, addressLine: event.target.value }))
                      }
                      autoComplete="street-address"
                    />
                  )}
                </Field>
              </CardBody>
            </>
          ) : null}

          {/* ── Step 3 ── */}
          {step === 2 ? (
            <>
              <CardHeader
                title="Health details"
                description="Entirely optional. Skip the whole step if you would rather not say."
              />
              <CardBody className="space-y-5">
                <Notice tone="info" title="Why we ask">
                  <p>
                    Symptoms matter more than any image. A chest X-ray can look normal in someone
                    who has TB, so whoever reads your record needs to know what you have been
                    experiencing. Only health professionals assigned to your care can see these
                    answers, and you can change or withdraw them at any time.
                  </p>
                </Notice>

                <Field
                  label="Have you had any of these?"
                  hint="Tick anything that applies. Nothing here is a diagnosis."
                >
                  {() => (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {SYMPTOM_OPTIONS.map((option) => (
                        <Checkbox
                          key={option.id}
                          label={option.label}
                          checked={health.symptoms.includes(option.id)}
                          onChange={(checked) =>
                            setHealth((c) => ({
                              ...c,
                              shared: true,
                              symptoms: checked
                                ? [...c.symptoms, option.id]
                                : c.symptoms.filter((item) => item !== option.id),
                            }))
                          }
                        />
                      ))}
                    </div>
                  )}
                </Field>

                {health.symptoms.length > 0 ? (
                  <Field
                    label="Roughly how many weeks has this been going on?"
                    hint="A cough lasting more than two weeks is the usual reason to get checked."
                  >
                    {({ id }) => (
                      <TextInput
                        id={id}
                        type="number"
                        min={0}
                        max={260}
                        value={health.symptomWeeks ?? ''}
                        onChange={(event) =>
                          setHealth((c) => ({
                            ...c,
                            symptomWeeks: event.target.value ? Number(event.target.value) : null,
                          }))
                        }
                        className="max-w-32"
                      />
                    )}
                  </Field>
                ) : null}

                <Field label="Have you been treated for TB before?">
                  {() => (
                    <RadioGroup
                      name="priorTb"
                      value={health.priorTb}
                      onChange={(value) => setHealth((c) => ({ ...c, shared: true, priorTb: value }))}
                      options={[
                        { value: 'never', label: 'No, never' },
                        { value: 'treated', label: 'Yes, and I finished treatment' },
                        { value: 'ongoing', label: 'Yes, I am being treated now' },
                        { value: 'prefer-not-to-say', label: 'I would rather not say' },
                      ]}
                    />
                  )}
                </Field>

                <Field label="Anything else you want on your record?">
                  {({ id }) => (
                    <TextArea
                      id={id}
                      rows={3}
                      value={health.notes}
                      onChange={(event) => setHealth((c) => ({ ...c, notes: event.target.value }))}
                      placeholder="Optional"
                    />
                  )}
                </Field>
              </CardBody>
            </>
          ) : null}

          {/* ── Step 4 ── */}
          {step === 3 ? (
            <>
              <CardHeader
                title="Check and confirm"
                description="Go back to any step to change an answer."
              />
              <CardBody className="space-y-5">
                <dl className="divide-y divide-obsidian-100">
                  <DetailRow label="Name">{personal.fullName || '—'}</DetailRow>
                  <DetailRow label="Date of birth">
                    {personal.birthDate ? formatDate(personal.birthDate) : '—'}
                  </DetailRow>
                  <DetailRow label="Phone">{personal.phone || '—'}</DetailRow>
                  <DetailRow label="Lives in">
                    {[address.village, address.district, address.province]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </DetailRow>
                  <DetailRow label="Health details">
                    {health.shared
                      ? health.symptoms.length > 0
                        ? `${health.symptoms.length} symptom${health.symptoms.length === 1 ? '' : 's'} reported`
                        : 'Answered, no symptoms reported'
                      : 'Not shared'}
                  </DetailRow>
                </dl>

                <div className="space-y-3 rounded-card border border-obsidian-200 bg-obsidian-50 p-4">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-obsidian-900">
                    <Lock aria-hidden className="size-3.5 text-ct-700" />
                    How your information is used
                  </p>
                  <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-obsidian-600">
                    <li>Your name and contact details identify your record and let a health worker reach you.</li>
                    <li>Only professionals assigned to your care can open your records.</li>
                    <li>Other patients can never see your information.</li>
                    <li>You can edit or withdraw your health answers from your profile at any time.</li>
                  </ul>

                  <div className="space-y-2.5 pt-1">
                    <Checkbox
                      label="I agree to my name, contact details and address being used to manage my account and care."
                      checked={consent.dataUse}
                      onChange={(checked) => {
                        setConsent((c) => ({ ...c, dataUse: checked }));
                        setErrors((c) => ({ ...c, consent: '' }));
                      }}
                    />
                    {health.shared ? (
                      <Checkbox
                        label="I agree to my health answers being shared with the health professionals assigned to my care."
                        description="Optional. Declining keeps your account; the answers simply stay unshared."
                        checked={consent.healthInfo}
                        onChange={(checked) => setConsent((c) => ({ ...c, healthInfo: checked }))}
                      />
                    ) : null}
                  </div>

                  {errors.consent ? (
                    <p role="alert" className="text-[12.5px] text-urgent-700">
                      {errors.consent}
                    </p>
                  ) : null}
                </div>

                <Notice tone="attention" compact>
                  PULMO does not diagnose tuberculosis. Anything it shows you is there to help you
                  decide whether to get tested, and to keep your records together.
                </Notice>
              </CardBody>
            </>
          ) : null}
        </Card>

        {/* Navigation */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            leadingIcon={<ArrowLeft className="size-4" />}
          >
            Back
          </Button>

          <div className="flex items-center gap-2">
            {step === 2 ? (
              <Button variant="outline" onClick={skipHealth}>
                Skip this step
              </Button>
            ) : null}
            <Button
              variant="primary"
              onClick={goNext}
              trailingIcon={
                step === 3 ? <Check className="size-4" /> : <ArrowRight className="size-4" />
              }
            >
              {step === 3 ? 'Finish' : 'Continue'}
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-obsidian-500">
          Your answers are saved as you go, so you can close this and come back.
        </p>
      </main>
    </div>
  );
}
