import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  Save,
  ScanLine,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, DetailRow } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/forms/Stepper';
import { Field, Fieldset } from '@/components/forms/Field';
import { Checkbox, RadioGroup, Select, TextArea, TextInput } from '@/components/forms/Inputs';
import { ImageUpload, type SelectedImage } from '@/components/screening/ImageUpload';
import { Notice, SimulatedResultNotice } from '@/components/ui/Notice';
import { ImageQualityBadge } from '@/components/ui/StatusBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useDataStore } from '@/stores/dataStore';
import { useIsConnected } from '@/stores/connectionStore';
import { toast } from '@/stores/toastStore';
import { imageKeyFor, putImage } from '@/services/imageStore';
import { ApiError, errorMessage } from '@/lib/apiClient';
import { recordsApi } from '@/services/recordsApi';
import { createId } from '@/utils/id';
import { ageFromBirthDate, toISODate, startOfToday } from '@/utils/date';
import { DISTRICTS, VILLAGES, type District } from '@/data/geography';
import { riskFactorLabel, symptomLabel } from '@/utils/labels';
import type {
  ImageQuality,
  Patient,
  RiskFactor,
  Sex,
  SymptomSet,
} from '@/types/domain';

/**
 * New screening.
 *
 * Five grouped steps, validated one at a time so a health worker is never
 * presented with a wall of errors. The patient step allows either picking
 * someone already in the register or registering a new person inline, because
 * in the field those happen in the same visit.
 */

const STEPS = [
  { id: 'patient', label: 'Patient', hint: 'Select or register' },
  { id: 'details', label: 'Screening details', hint: 'Vitals and context' },
  { id: 'symptoms', label: 'Symptoms', hint: 'What the patient reports' },
  { id: 'image', label: 'Chest X-ray', hint: 'Upload the radiograph' },
  { id: 'review', label: 'Review', hint: 'Confirm and submit' },
];

const EMPTY_SYMPTOMS: SymptomSet = {
  coughWeeks: 0,
  hemoptysis: false,
  nightSweats: false,
  weightLoss: false,
  fever: false,
  chestPain: false,
  fatigue: false,
  appetiteLoss: false,
};

const BOOLEAN_SYMPTOMS: (keyof SymptomSet)[] = [
  'hemoptysis',
  'nightSweats',
  'weightLoss',
  'fever',
  'chestPain',
  'fatigue',
  'appetiteLoss',
];

const RISK_OPTIONS: RiskFactor[] = [
  'household-tb-contact',
  'diabetes',
  'hiv',
  'smoker',
  'malnutrition',
  'prior-tb-treatment',
  'crowded-housing',
];

type Mode = 'existing' | 'new';

export function NewScreeningPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const connected = useIsConnected();

  const patients = useDataStore((state) => state.patients);
  const saveDraft = useDataStore((state) => state.saveDraft);
  const finalizeDraft = useDataStore((state) => state.finalizeDraft);
  const analyzeScreening = useDataStore((state) => state.analyzeScreening);

  /**
   * Resuming a saved draft. The record keeps its original id and queue entry,
   * so finishing it here does not leave an orphaned draft behind.
   */
  const draftId = searchParams.get('draft');
  const draft = useDataStore((state) =>
    draftId ? (state.screenings.find((item) => item.id === draftId) ?? null) : null,
  );

  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<number | null>(null);

  /* Step 1: patient */
  const [mode, setMode] = useState<Mode>('existing');
  const [patientQuery, setPatientQuery] = useState('');
  const [patientId, setPatientId] = useState<string | null>(
    draft?.patientId ?? searchParams.get('patient'),
  );
  const [newPatient, setNewPatient] = useState({
    name: '',
    sex: 'female' as Sex,
    birthDate: '',
    phone: '',
    district: DISTRICTS[0] as District,
    village: VILLAGES[DISTRICTS[0]][0]!,
    householdContacts: 0,
    riskFactors: [] as RiskFactor[],
  });

  /* Step 2: details. Pre-filled from the draft when resuming one. */
  const [vitals, setVitals] = useState({
    weightKg: draft?.vitals.weightKg != null ? String(draft.vitals.weightKg) : '',
    heightCm: draft?.vitals.heightCm != null ? String(draft.vitals.heightCm) : '',
    temperatureC: draft?.vitals.temperatureC != null ? String(draft.vitals.temperatureC) : '',
    respiratoryRate:
      draft?.vitals.respiratoryRate != null ? String(draft.vitals.respiratoryRate) : '',
  });
  const [imageQuality, setImageQuality] = useState<ImageQuality>(
    draft?.imageQuality ?? 'adequate',
  );
  const [contextNote, setContextNote] = useState('');

  /* Step 3: symptoms */
  const [symptoms, setSymptoms] = useState<SymptomSet>(draft?.symptoms ?? EMPTY_SYMPTOMS);

  /* Step 4: image */
  const [image, setImage] = useState<SelectedImage | null>(null);

  const matchingPatients = useMemo(() => {
    const term = patientQuery.trim().toLowerCase();
    const pool = term
      ? patients.filter(
          (patient) =>
            patient.name.toLowerCase().includes(term) ||
            patient.mrn.toLowerCase().includes(term) ||
            patient.village.toLowerCase().includes(term),
        )
      : patients;
    return pool.slice(0, 8);
  }, [patients, patientQuery]);

  const selectedPatient = patients.find((patient) => patient.id === patientId) ?? null;

  /* ── Validation ─────────────────────────────────────────────────────────── */

  const validateStep = (index: number): boolean => {
    const next: Record<string, string> = {};

    if (index === 0) {
      if (mode === 'existing') {
        if (!patientId) next.patient = 'Choose a patient from the register, or register a new one.';
      } else {
        if (!newPatient.name.trim()) next.name = 'Enter the patient’s full name.';
        else if (newPatient.name.trim().length < 3) next.name = 'That name looks too short.';

        if (!newPatient.birthDate) next.birthDate = 'Enter a date of birth.';
        else {
          const age = ageFromBirthDate(newPatient.birthDate);
          if (newPatient.birthDate > toISODate(startOfToday()))
            next.birthDate = 'Date of birth cannot be in the future.';
          else if (age > 120) next.birthDate = 'That date of birth is not plausible.';
        }

        if (newPatient.phone && !/^[\d\s+()-]{7,20}$/.test(newPatient.phone))
          next.phone = 'Enter a usable phone number, or leave it blank.';
      }
    }

    if (index === 1) {
      const weight = Number(vitals.weightKg);
      const height = Number(vitals.heightCm);
      const temperature = Number(vitals.temperatureC);
      const respiratory = Number(vitals.respiratoryRate);

      if (!vitals.weightKg) next.weightKg = 'Weight is needed for the screening record.';
      else if (Number.isNaN(weight) || weight < 2 || weight > 250)
        next.weightKg = 'Enter a weight between 2 and 250 kg.';

      if (vitals.heightCm && (Number.isNaN(height) || height < 40 || height > 230))
        next.heightCm = 'Enter a height between 40 and 230 cm.';

      if (vitals.temperatureC && (Number.isNaN(temperature) || temperature < 30 || temperature > 44))
        next.temperatureC = 'Enter a temperature between 30 and 44 °C.';

      if (
        vitals.respiratoryRate &&
        (Number.isNaN(respiratory) || respiratory < 6 || respiratory > 70)
      )
        next.respiratoryRate = 'Enter a respiratory rate between 6 and 70 breaths/min.';
    }

    if (index === 2) {
      if (symptoms.coughWeeks < 0 || symptoms.coughWeeks > 104)
        next.coughWeeks = 'Enter a cough duration between 0 and 104 weeks.';
    }

    if (index === 3) {
      if (!image) next.image = 'Attach a chest X-ray, or save this record as a draft to finish later.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setCompleted((current) => Array.from(new Set([...current, step])));
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
    setErrors({});
  };

  const goBack = () => {
    setStep((current) => Math.max(0, current - 1));
    setErrors({});
  };

  /* ── Submission ─────────────────────────────────────────────────────────── */

  const resolvePatient = async (): Promise<Patient | null> => {
    if (mode === 'existing') return selectedPatient;
    return recordsApi.createPatient({
      name: newPatient.name,
      sex: newPatient.sex,
      birthDate: newPatient.birthDate,
      phone: newPatient.phone || null,
      village: newPatient.village,
      district: newPatient.district,
      riskFactors: newPatient.riskFactors,
      householdContacts: newPatient.householdContacts,
    });
  };

  const parsedVitals = () => ({
    weightKg: vitals.weightKg ? Number(vitals.weightKg) : null,
    heightCm: vitals.heightCm ? Number(vitals.heightCm) : null,
    temperatureC: vitals.temperatureC ? Number(vitals.temperatureC) : null,
    respiratoryRate: vitals.respiratoryRate ? Number(vitals.respiratoryRate) : null,
  });

  /** Save the record to the server, then ask the screening model when one is connected. */
  const submit = async (asDraft: boolean) => {
    if (!asDraft && !validateStep(3)) {
      setStep(3);
      return;
    }
    if (mode === 'new' && !validateStep(0)) {
      setStep(0);
      return;
    }

    setSubmitting(true);
    try {
      const patient = await resolvePatient();
      if (!patient) {
        setErrors({ patient: 'Could not resolve the patient record.' });
        setStep(0);
        return;
      }

      // The radiograph is staged in IndexedDB first, then uploaded with the record
      // (or kept there until the record can be sent, when offline).
      let imageKey: string | null = null;
      if (image) {
        imageKey = imageKeyFor(createId('img'));
        await putImage(imageKey, image.file);
      }

      const draftPatch = {
        symptoms,
        vitals: parsedVitals(),
        imageKey: imageKey ?? draft?.imageKey ?? null,
        imageMeta: image?.meta ?? draft?.imageMeta ?? null,
        imageQuality,
      };

      let screening;
      if (draft) {
        // Finish the existing record in place.
        screening = asDraft
          ? await saveDraft(draft.id, draftPatch)
          : await finalizeDraft(draft.id, draftPatch, !connected);
      } else {
        screening = await recordsApi.createScreening({
          patientId: patient.id,
          symptoms,
          vitals: parsedVitals(),
          imageKey,
          imageMeta: image?.meta ?? null,
          imageQuality,
          offline: !connected,
          asDraft,
        });
      }

      // A record still carrying a "local_" id has not reached the server yet.
      const heldOnDevice = screening.id.startsWith('local_');

      if (contextNote.trim()) {
        if (heldOnDevice) {
          toast.attention(
            'Your context note was not saved.',
            'Notes need a connection. Add it from the patient record once this screening has been sent.',
          );
        } else {
          try {
            await useDataStore
              .getState()
              .addPatientNote(patient.id, contextNote, 'screening', screening.id);
          } catch (cause) {
            toast.error('The screening was saved, but the note was not.', errorMessage(cause));
          }
        }
      }

      if (asDraft) {
        toast.success(
          heldOnDevice
            ? 'Saved as a draft on this device.'
            : draft
              ? 'Draft updated.'
              : 'Saved as a draft.',
          heldOnDevice
            ? 'Finish it from the offline queue when you are ready.'
            : 'Open it from the screening history to finish it.',
        );
        navigate(heldOnDevice ? '/offline' : '/reports?status=draft');
        return;
      }

      if (heldOnDevice) {
        toast.attention(
          'Record queued on this device.',
          connected
            ? 'It could not be sent just now. Retry it from the offline queue.'
            : 'It will be sent when a connection is available. Image analysis needs a connection.',
        );
        navigate('/offline');
        return;
      }

      // Ask the server to run the screening model. If none is connected the
      // record is still saved and goes to a clinician without model output.
      setAnalysisProgress(10);
      const ticker = window.setInterval(() => {
        setAnalysisProgress((value) => (value === null ? null : Math.min(92, value + 11)));
      }, 170);

      let analysed = false;
      try {
        await analyzeScreening(screening.id);
        analysed = true;
        setAnalysisProgress(100);
      } catch (cause) {
        if (cause instanceof ApiError && cause.code === 'MODEL_NOT_CONNECTED') {
          toast.info(
            'Record saved.',
            'The screening model is not connected, so it goes to a clinician without model output.',
          );
        } else {
          // Analysis failing must not lose the record.
          toast.error('Analysis could not be completed.', errorMessage(cause));
        }
      } finally {
        window.clearInterval(ticker);
      }

      if (analysed) {
        toast.custom({
          tone: 'success',
          title: 'Screening record created.',
          description: 'The model has finished and the record needs a clinical review.',
        });
      }
      navigate(`/screenings/${screening.id}`);
    } catch (cause) {
      toast.error('Could not save the screening.', errorMessage(cause));
    } finally {
      setSubmitting(false);
      setAnalysisProgress(null);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */

  const reviewPatientName =
    mode === 'existing' ? (selectedPatient?.name ?? 'Not selected') : newPatient.name || 'Not entered';

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title={draft ? 'Finish saved screening' : 'New screening'}
        description={
          draft
            ? 'Resuming a saved draft. The record keeps its original reference.'
            : 'Record a TB screening encounter and attach the chest radiograph. It is saved to the PULMO server, or held on this device if you are offline.'
        }
        actions={
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        }
      />

      {draft ? (
        <Notice tone="info" title="Resuming a saved draft">
          Symptoms, vitals and the image-quality rating were restored from the draft. Attach the
          radiograph to complete it.
        </Notice>
      ) : null}

      {!connected ? (
        <Notice tone="attention" title="You are offline">
          The form works normally and the record will be stored on this device. Image analysis
          cannot run until a connection is available.
        </Notice>
      ) : null}

      <Card>
        <CardBody className="border-b border-obsidian-200">
          <Stepper
            steps={STEPS}
            current={step}
            completed={completed}
            onStepClick={(index) => {
              setStep(index);
              setErrors({});
            }}
          />
        </CardBody>

        {/* ── Step 1: Patient ── */}
        {step === 0 ? (
          <CardBody className="space-y-4">
            <div
              role="group"
              aria-label="Patient source"
              className="flex gap-1 rounded-md bg-obsidian-100 p-0.5"
            >
              <ModeTab
                active={mode === 'existing'}
                onClick={() => setMode('existing')}
                icon={<Users className="size-4" />}
                label="Existing patient"
              />
              <ModeTab
                active={mode === 'new'}
                onClick={() => setMode('new')}
                icon={<UserPlus className="size-4" />}
                label="Register new"
              />
            </div>

            {mode === 'existing' ? (
              <div>
                <Field label="Find the patient" error={errors.patient ?? null} required>
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      value={patientQuery}
                      onChange={(event) => setPatientQuery(event.target.value)}
                      describedBy={describedBy}
                      invalid={invalid}
                      leadingIcon={<Search />}
                      placeholder="Name, record number or village"
                    />
                  )}
                </Field>

                <ul className="mt-3 max-h-80 divide-y divide-obsidian-100 overflow-y-auto rounded-md border border-obsidian-200">
                  {matchingPatients.length === 0 ? (
                    <li className="px-3 py-6 text-center text-[13px] text-obsidian-500">
                      No patient matches that search.{' '}
                      <button
                        type="button"
                        onClick={() => setMode('new')}
                        className="font-medium text-ct-700 underline decoration-ct-300 underline-offset-2"
                      >
                        Register a new patient
                      </button>
                      .
                    </li>
                  ) : (
                    matchingPatients.map((patient) => {
                      const active = patient.id === patientId;
                      return (
                        <li key={patient.id}>
                          <button
                            type="button"
                            onClick={() => setPatientId(patient.id)}
                            aria-pressed={active}
                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                              active ? 'bg-ct-50' : 'hover:bg-obsidian-50'
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-obsidian-900">
                                {patient.name}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-obsidian-500">
                                <span className="font-mono">{patient.mrn}</span> ·{' '}
                                {ageFromBirthDate(patient.birthDate)} yrs · {patient.village}
                              </span>
                            </span>
                            {active ? (
                              <CheckCircle2 aria-hidden className="size-4 shrink-0 text-ct-700" />
                            ) : null}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" error={errors.name ?? null} required className="sm:col-span-2">
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      value={newPatient.name}
                      onChange={(event) =>
                        setNewPatient((current) => ({ ...current, name: event.target.value }))
                      }
                      describedBy={describedBy}
                      invalid={invalid}
                      autoComplete="off"
                      placeholder="As written on the patient’s ID"
                    />
                  )}
                </Field>

                <Field label="Sex" required>
                  {({ id }) => (
                    <Select
                      id={id}
                      value={newPatient.sex}
                      onChange={(event) =>
                        setNewPatient((current) => ({
                          ...current,
                          sex: event.target.value as Sex,
                        }))
                      }
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                    </Select>
                  )}
                </Field>

                <Field label="Date of birth" error={errors.birthDate ?? null} required>
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      type="date"
                      max={toISODate(startOfToday())}
                      value={newPatient.birthDate}
                      onChange={(event) =>
                        setNewPatient((current) => ({ ...current, birthDate: event.target.value }))
                      }
                      describedBy={describedBy}
                      invalid={invalid}
                    />
                  )}
                </Field>

                <Field
                  label="Phone"
                  error={errors.phone ?? null}
                  optional
                  hint="Used for follow-up contact."
                >
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      type="tel"
                      value={newPatient.phone}
                      onChange={(event) =>
                        setNewPatient((current) => ({ ...current, phone: event.target.value }))
                      }
                      describedBy={describedBy}
                      invalid={invalid}
                      placeholder="08xx-xxxx-xxxx"
                    />
                  )}
                </Field>

                <Field label="Household contacts" hint="People sharing the same dwelling.">
                  {({ id }) => (
                    <TextInput
                      id={id}
                      type="number"
                      min={0}
                      max={30}
                      value={String(newPatient.householdContacts)}
                      onChange={(event) =>
                        setNewPatient((current) => ({
                          ...current,
                          householdContacts: Math.max(0, Number(event.target.value) || 0),
                        }))
                      }
                    />
                  )}
                </Field>

                <Field label="District" required>
                  {({ id }) => (
                    <Select
                      id={id}
                      value={newPatient.district}
                      onChange={(event) => {
                        const district = event.target.value as District;
                        setNewPatient((current) => ({
                          ...current,
                          district,
                          village: VILLAGES[district][0]!,
                        }));
                      }}
                    >
                      {DISTRICTS.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Field label="Village" required>
                  {({ id }) => (
                    <Select
                      id={id}
                      value={newPatient.village}
                      onChange={(event) =>
                        setNewPatient((current) => ({ ...current, village: event.target.value }))
                      }
                    >
                      {VILLAGES[newPatient.district].map((village) => (
                        <option key={village} value={village}>
                          {village}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Fieldset
                  legend="Risk factors"
                  hint="Recorded for context; they do not change the screening output."
                  className="sm:col-span-2"
                >
                  <div className="grid gap-0.5 sm:grid-cols-2">
                    {RISK_OPTIONS.map((factor) => (
                      <Checkbox
                        key={factor}
                        label={riskFactorLabel[factor]}
                        checked={newPatient.riskFactors.includes(factor)}
                        onChange={(checked) =>
                          setNewPatient((current) => ({
                            ...current,
                            riskFactors: checked
                              ? [...current.riskFactors, factor]
                              : current.riskFactors.filter((item) => item !== factor),
                          }))
                        }
                      />
                    ))}
                  </div>
                </Fieldset>
              </div>
            )}
          </CardBody>
        ) : null}

        {/* ── Step 2: Details ── */}
        {step === 1 ? (
          <CardBody className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Weight" error={errors.weightKg ?? null} required>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    type="number"
                    step="0.1"
                    value={vitals.weightKg}
                    onChange={(event) =>
                      setVitals((current) => ({ ...current, weightKg: event.target.value }))
                    }
                    describedBy={describedBy}
                    invalid={invalid}
                    suffix="kg"
                  />
                )}
              </Field>
              <Field label="Height" error={errors.heightCm ?? null} optional>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    type="number"
                    value={vitals.heightCm}
                    onChange={(event) =>
                      setVitals((current) => ({ ...current, heightCm: event.target.value }))
                    }
                    describedBy={describedBy}
                    invalid={invalid}
                    suffix="cm"
                  />
                )}
              </Field>
              <Field label="Temperature" error={errors.temperatureC ?? null} optional>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    type="number"
                    step="0.1"
                    value={vitals.temperatureC}
                    onChange={(event) =>
                      setVitals((current) => ({ ...current, temperatureC: event.target.value }))
                    }
                    describedBy={describedBy}
                    invalid={invalid}
                    suffix="°C"
                  />
                )}
              </Field>
              <Field label="Respiratory rate" error={errors.respiratoryRate ?? null} optional>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    type="number"
                    value={vitals.respiratoryRate}
                    onChange={(event) =>
                      setVitals((current) => ({ ...current, respiratoryRate: event.target.value }))
                    }
                    describedBy={describedBy}
                    invalid={invalid}
                    suffix="/min"
                  />
                )}
              </Field>
            </div>

            <Fieldset
              legend="Radiograph quality"
              hint="Your assessment of the image you are about to attach. An inadequate image cannot produce a usable screening result."
            >
              <RadioGroup<ImageQuality>
                name="image-quality"
                value={imageQuality}
                onChange={setImageQuality}
                options={[
                  {
                    value: 'adequate',
                    label: 'Adequate',
                    description: 'Full lung fields visible, good inspiration, no motion blur.',
                  },
                  {
                    value: 'borderline',
                    label: 'Borderline',
                    description: 'Readable but compromised by slight rotation, exposure or blur.',
                  },
                  {
                    value: 'inadequate',
                    label: 'Inadequate',
                    description: 'Not interpretable. The record will be marked inconclusive.',
                  },
                ]}
              />
            </Fieldset>

            <Field
              label="Encounter note"
              optional
              hint="Added to the patient’s timeline. Anything the next person should know."
            >
              {({ id, describedBy }) => (
                <TextArea
                  id={id}
                  value={contextNote}
                  onChange={(event) => setContextNote(event.target.value)}
                  describedBy={describedBy}
                  rows={3}
                  placeholder="e.g. Patient travelled 2 hours; prefers contact through the village cadre."
                />
              )}
            </Field>
          </CardBody>
        ) : null}

        {/* ── Step 3: Symptoms ── */}
        {step === 2 ? (
          <CardBody className="space-y-5">
            <Field
              label="How long has the cough lasted?"
              error={errors.coughWeeks ?? null}
              hint="Enter 0 if the patient has no cough. A cough of two weeks or more is the usual trigger for TB screening."
            >
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  type="number"
                  min={0}
                  max={104}
                  className="max-w-40"
                  value={String(symptoms.coughWeeks)}
                  onChange={(event) =>
                    setSymptoms((current) => ({
                      ...current,
                      coughWeeks: Math.max(0, Number(event.target.value) || 0),
                    }))
                  }
                  describedBy={describedBy}
                  invalid={invalid}
                  suffix="weeks"
                />
              )}
            </Field>

            <Fieldset
              legend="Other symptoms reported"
              hint="Tick everything the patient describes."
            >
              <div className="grid gap-0.5 sm:grid-cols-2">
                {BOOLEAN_SYMPTOMS.map((key) => (
                  <Checkbox
                    key={key}
                    label={symptomLabel[key] ?? key}
                    checked={Boolean(symptoms[key])}
                    onChange={(checked) =>
                      setSymptoms((current) => ({ ...current, [key]: checked }))
                    }
                  />
                ))}
              </div>
            </Fieldset>

            <Notice tone="info" compact>
              Symptoms are part of the clinical record and are read by the clinician who reviews
              this screening.
            </Notice>
          </CardBody>
        ) : null}

        {/* ── Step 4: Image ── */}
        {step === 3 ? (
          <CardBody className="space-y-4">
            <ImageUpload value={image} onChange={setImage} error={errors.image ?? null} />
          </CardBody>
        ) : null}

        {/* ── Step 5: Review ── */}
        {step === 4 ? (
          <CardBody className="space-y-4">
            <SimulatedResultNotice variant="compact" />

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-md border border-obsidian-200 p-3.5">
                <h3 className="text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                  Patient
                </h3>
                <dl className="mt-2 divide-y divide-obsidian-100">
                  <DetailRow label="Name">{reviewPatientName}</DetailRow>
                  {mode === 'existing' && selectedPatient ? (
                    <>
                      <DetailRow label="Record no.">
                        <span className="font-mono text-xs">{selectedPatient.mrn}</span>
                      </DetailRow>
                      <DetailRow label="Age">
                        {ageFromBirthDate(selectedPatient.birthDate)} years
                      </DetailRow>
                      <DetailRow label="Village">
                        {selectedPatient.village}, {selectedPatient.district}
                      </DetailRow>
                    </>
                  ) : (
                    <>
                      <DetailRow label="Date of birth">{newPatient.birthDate || 'Not entered'}</DetailRow>
                      <DetailRow label="Village">
                        {newPatient.village}, {newPatient.district}
                      </DetailRow>
                      <DetailRow label="Status">
                        <span className="text-ct-700">Will be registered on submit</span>
                      </DetailRow>
                    </>
                  )}
                </dl>
              </section>

              <section className="rounded-md border border-obsidian-200 p-3.5">
                <h3 className="text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                  Screening
                </h3>
                <dl className="mt-2 divide-y divide-obsidian-100">
                  <DetailRow label="Weight">
                    {vitals.weightKg ? `${vitals.weightKg} kg` : 'Not entered'}
                  </DetailRow>
                  <DetailRow label="Temperature">
                    {vitals.temperatureC ? `${vitals.temperatureC} °C` : 'Not recorded'}
                  </DetailRow>
                  <DetailRow label="Cough">
                    {symptoms.coughWeeks > 0
                      ? `${symptoms.coughWeeks} week${symptoms.coughWeeks === 1 ? '' : 's'}`
                      : 'None reported'}
                  </DetailRow>
                  <DetailRow label="Other symptoms">
                    {BOOLEAN_SYMPTOMS.filter((key) => symptoms[key]).length === 0
                      ? 'None reported'
                      : BOOLEAN_SYMPTOMS.filter((key) => symptoms[key])
                          .map((key) => symptomLabel[key] ?? key)
                          .join(', ')}
                  </DetailRow>
                  <DetailRow label="Image quality">
                    <ImageQualityBadge quality={imageQuality} size="sm" />
                  </DetailRow>
                  <DetailRow label="Radiograph">
                    {image ? (
                      <span className="truncate">{image.meta.fileName}</span>
                    ) : (
                      <span className="text-attention-800">Not attached</span>
                    )}
                  </DetailRow>
                </dl>
              </section>
            </div>

            {analysisProgress !== null ? (
              <div className="rounded-md border border-ct-200 bg-ct-50 px-3.5 py-3">
                <ProgressBar
                  value={analysisProgress}
                  label="Running the screening model"
                />
                <p className="mt-2 text-xs text-obsidian-600">
                  The radiograph has been saved and is being sent to the screening model. If no
                  model is connected, the record goes straight to a clinician for review.
                </p>
              </div>
            ) : null}
          </CardBody>
        ) : null}

        {/* ── Footer actions ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-obsidian-200 bg-obsidian-50/70 px-4 py-3">
          <Button
            variant="ghost"
            disabled={step === 0 || submitting}
            leadingIcon={<ArrowLeft className="size-4" />}
            onClick={goBack}
          >
            Back
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={submitting}
              leadingIcon={<Save className="size-4" />}
              onClick={() => void submit(true)}
            >
              Save as draft
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                variant="primary"
                onClick={goNext}
                disabled={submitting}
                trailingIcon={<ArrowRight className="size-4" />}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={submitting}
                leadingIcon={
                  connected ? <ScanLine className="size-4" /> : <CloudOff className="size-4" />
                }
                onClick={() => void submit(false)}
              >
                {connected ? 'Submit screening' : 'Save and queue'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex flex-1 items-center justify-center gap-2 rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? 'bg-white text-obsidian-950 shadow-card'
          : 'text-obsidian-500 hover:text-obsidian-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
