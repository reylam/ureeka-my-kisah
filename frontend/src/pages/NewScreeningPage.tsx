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
  { id: 'patient', label: 'Pasien', hint: 'Pilih atau daftarkan' },
  { id: 'details', label: 'Detail screening', hint: 'Tanda vital dan konteks' },
  { id: 'symptoms', label: 'Gejala', hint: 'Keluhan dari pasien' },
  { id: 'image', label: 'X-ray dada', hint: 'Upload hasil rontgen' },
  { id: 'review', label: 'Review', hint: 'Konfirmasi dan kirim' },
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
        if (!patientId) next.patient = 'Pilih pasien dari daftar, atau daftarkan pasien baru.';
      } else {
        if (!newPatient.name.trim()) next.name = 'Isi nama lengkap pasien.';
        else if (newPatient.name.trim().length < 3) next.name = 'Nama terlalu pendek.';

        if (!newPatient.birthDate) next.birthDate = 'Isi tanggal lahir.';
        else {
          const age = ageFromBirthDate(newPatient.birthDate);
          if (newPatient.birthDate > toISODate(startOfToday()))
            next.birthDate = 'Tanggal lahir tidak boleh di masa depan.';
          else if (age > 120) next.birthDate = 'Tanggal lahir ini tidak masuk akal.';
        }

        if (newPatient.phone && !/^[\d\s+()-]{7,20}$/.test(newPatient.phone))
          next.phone = 'Isi nomor telepon yang valid, atau kosongkan saja.';
      }
    }

    if (index === 1) {
      const weight = Number(vitals.weightKg);
      const height = Number(vitals.heightCm);
      const temperature = Number(vitals.temperatureC);
      const respiratory = Number(vitals.respiratoryRate);

      if (!vitals.weightKg) next.weightKg = 'Berat badan wajib diisi untuk record screening.';
      else if (Number.isNaN(weight) || weight < 2 || weight > 250)
        next.weightKg = 'Isi berat badan antara 2 dan 250 kg.';

      if (vitals.heightCm && (Number.isNaN(height) || height < 40 || height > 230))
        next.heightCm = 'Isi tinggi badan antara 40 dan 230 cm.';

      if (vitals.temperatureC && (Number.isNaN(temperature) || temperature < 30 || temperature > 44))
        next.temperatureC = 'Isi suhu tubuh antara 30 dan 44 °C.';

      if (
        vitals.respiratoryRate &&
        (Number.isNaN(respiratory) || respiratory < 6 || respiratory > 70)
      )
        next.respiratoryRate = 'Isi laju napas antara 6 dan 70 napas/menit.';
    }

    if (index === 2) {
      if (symptoms.coughWeeks < 0 || symptoms.coughWeeks > 104)
        next.coughWeeks = 'Isi durasi batuk antara 0 dan 104 minggu.';
    }

    if (index === 3) {
      if (!image) next.image = 'Lampirkan X-ray dada, atau simpan record ini sebagai draf untuk dilanjutkan nanti.';
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
        setErrors({ patient: 'Data pasien tidak ditemukan.' });
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
            'Catatan konteks belum tersimpan.',
            'Catatan butuh koneksi. Tambahkan dari data pasien setelah screening ini terkirim.',
          );
        } else {
          try {
            await useDataStore
              .getState()
              .addPatientNote(patient.id, contextNote, 'screening', screening.id);
          } catch (cause) {
            toast.error('Screening tersimpan, tapi catatannya belum.', errorMessage(cause));
          }
        }
      }

      if (asDraft) {
        toast.success(
          heldOnDevice
            ? 'Disimpan sebagai draf di perangkat ini.'
            : draft
              ? 'Draf diperbarui.'
              : 'Disimpan sebagai draf.',
          heldOnDevice
            ? 'Lanjutkan dari offline queue kapan pun kamu siap.'
            : 'Buka dari riwayat screening untuk menyelesaikannya.',
        );
        navigate(heldOnDevice ? '/offline' : '/reports?status=draft');
        return;
      }

      if (heldOnDevice) {
        toast.attention(
          'Record masuk antrean di perangkat ini.',
          connected
            ? 'Record belum bisa dikirim saat ini. Coba lagi dari offline queue.'
            : 'Record akan dikirim saat koneksi tersedia. Analisis gambar butuh koneksi.',
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
            'Record tersimpan.',
            'Model screening belum terhubung, jadi record diteruskan ke tenaga medis tanpa output model.',
          );
        } else {
          // Analysis failing must not lose the record.
          toast.error('Analisis tidak bisa diselesaikan.', errorMessage(cause));
        }
      } finally {
        window.clearInterval(ticker);
      }

      if (analysed) {
        toast.custom({
          tone: 'success',
          title: 'Record screening berhasil dibuat.',
          description: 'Model sudah selesai dan record perlu review klinis.',
        });
      }
      navigate(`/screenings/${screening.id}`);
    } catch (cause) {
      toast.error('Screening gagal disimpan.', errorMessage(cause));
    } finally {
      setSubmitting(false);
      setAnalysisProgress(null);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */

  const reviewPatientName =
    mode === 'existing' ? (selectedPatient?.name ?? 'Belum dipilih') : newPatient.name || 'Belum diisi';

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title={draft ? 'Selesaikan screening tersimpan' : 'Screening baru'}
        description={
          draft
            ? 'Melanjutkan draf yang tersimpan. Record tetap memakai referensi aslinya.'
            : 'Catat pertemuan screening TB dan lampirkan X-ray dada. Data disimpan ke server PARUPINTAS, atau ditahan di perangkat ini kalau kamu sedang offline.'
        }
        actions={
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Batal
          </Button>
        }
      />

      {draft ? (
        <Notice tone="info" title="Melanjutkan draf tersimpan">
          Gejala, tanda vital, dan penilaian kualitas gambar sudah dipulihkan dari draf. Lampirkan
          X-ray untuk menyelesaikannya.
        </Notice>
      ) : null}

      {!connected ? (
        <Notice tone="attention" title="Kamu sedang offline">
          Form tetap berfungsi normal dan record akan disimpan di perangkat ini. Analisis gambar
          baru bisa jalan setelah koneksi tersedia.
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
              aria-label="Sumber data pasien"
              className="flex gap-1 rounded-md bg-obsidian-100 p-0.5"
            >
              <ModeTab
                active={mode === 'existing'}
                onClick={() => setMode('existing')}
                icon={<Users className="size-4" />}
                label="Pasien terdaftar"
              />
              <ModeTab
                active={mode === 'new'}
                onClick={() => setMode('new')}
                icon={<UserPlus className="size-4" />}
                label="Daftarkan baru"
              />
            </div>

            {mode === 'existing' ? (
              <div>
                <Field label="Cari pasien" error={errors.patient ?? null} required>
                  {({ id, describedBy, invalid }) => (
                    <TextInput
                      id={id}
                      value={patientQuery}
                      onChange={(event) => setPatientQuery(event.target.value)}
                      describedBy={describedBy}
                      invalid={invalid}
                      leadingIcon={<Search />}
                      placeholder="Nama, nomor rekam medis, atau desa"
                    />
                  )}
                </Field>

                <ul className="mt-3 max-h-80 divide-y divide-obsidian-100 overflow-y-auto rounded-md border border-obsidian-200">
                  {matchingPatients.length === 0 ? (
                    <li className="px-3 py-6 text-center text-[13px] text-obsidian-500">
                      Tidak ada pasien yang cocok dengan pencarian ini.{' '}
                      <button
                        type="button"
                        onClick={() => setMode('new')}
                        className="font-medium text-ct-700 underline decoration-ct-300 underline-offset-2"
                      >
                        Daftarkan pasien baru
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
                                {ageFromBirthDate(patient.birthDate)} thn · {patient.village}
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
                <Field label="Nama lengkap" error={errors.name ?? null} required className="sm:col-span-2">
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
                      placeholder="Sesuai yang tertulis di KTP pasien"
                    />
                  )}
                </Field>

                <Field label="Jenis kelamin" required>
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
                      <option value="female">Perempuan</option>
                      <option value="male">Laki-laki</option>
                    </Select>
                  )}
                </Field>

                <Field label="Tanggal lahir" error={errors.birthDate ?? null} required>
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
                  label="Telepon"
                  error={errors.phone ?? null}
                  optional
                  hint="Dipakai untuk menghubungi saat follow-up."
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

                <Field label="Kontak serumah" hint="Orang yang tinggal di rumah yang sama.">
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

                <Field label="Kecamatan" required>
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

                <Field label="Desa" required>
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
                  legend="Faktor risiko"
                  hint="Dicatat sebagai konteks; tidak mengubah output screening."
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
              <Field label="Berat badan" error={errors.weightKg ?? null} required>
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
              <Field label="Tinggi badan" error={errors.heightCm ?? null} optional>
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
              <Field label="Suhu tubuh" error={errors.temperatureC ?? null} optional>
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
              <Field label="Laju napas" error={errors.respiratoryRate ?? null} optional>
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
                    suffix="/menit"
                  />
                )}
              </Field>
            </div>

            <Fieldset
              legend="Kualitas X-ray"
              hint="Penilaianmu atas gambar yang akan dilampirkan. Gambar yang kurang layak tidak akan menghasilkan hasil screening yang bisa dipakai."
            >
              <RadioGroup<ImageQuality>
                name="image-quality"
                value={imageQuality}
                onChange={setImageQuality}
                options={[
                  {
                    value: 'adequate',
                    label: 'Layak',
                    description: 'Seluruh lapang paru terlihat, inspirasi baik, tidak ada blur akibat gerakan.',
                  },
                  {
                    value: 'borderline',
                    label: 'Batas layak',
                    description: 'Masih terbaca, tapi terganggu rotasi, eksposur, atau blur ringan.',
                  },
                  {
                    value: 'inadequate',
                    label: 'Tidak layak',
                    description: 'Tidak bisa diinterpretasi. Record akan ditandai tidak meyakinkan.',
                  },
                ]}
              />
            </Fieldset>

            <Field
              label="Catatan kunjungan"
              optional
              hint="Ditambahkan ke timeline pasien. Apa pun yang perlu diketahui petugas berikutnya."
            >
              {({ id, describedBy }) => (
                <TextArea
                  id={id}
                  value={contextNote}
                  onChange={(event) => setContextNote(event.target.value)}
                  describedBy={describedBy}
                  rows={3}
                  placeholder="mis. Pasien menempuh perjalanan 2 jam; lebih suka dihubungi lewat kader desa."
                />
              )}
            </Field>
          </CardBody>
        ) : null}

        {/* ── Step 3: Symptoms ── */}
        {step === 2 ? (
          <CardBody className="space-y-5">
            <Field
              label="Sudah berapa lama batuk?"
              error={errors.coughWeeks ?? null}
              hint="Isi 0 kalau pasien tidak batuk. Batuk dua minggu atau lebih biasanya jadi pemicu screening TB."
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
                  suffix="minggu"
                />
              )}
            </Field>

            <Fieldset
              legend="Gejala lain yang dilaporkan"
              hint="Centang semua yang disampaikan pasien."
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
              Gejala adalah bagian dari rekam klinis dan dibaca oleh tenaga medis yang me-review
              screening ini.
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
                  Pasien
                </h3>
                <dl className="mt-2 divide-y divide-obsidian-100">
                  <DetailRow label="Nama">{reviewPatientName}</DetailRow>
                  {mode === 'existing' && selectedPatient ? (
                    <>
                      <DetailRow label="No. rekam medis">
                        <span className="font-mono text-xs">{selectedPatient.mrn}</span>
                      </DetailRow>
                      <DetailRow label="Usia">
                        {ageFromBirthDate(selectedPatient.birthDate)} tahun
                      </DetailRow>
                      <DetailRow label="Desa">
                        {selectedPatient.village}, {selectedPatient.district}
                      </DetailRow>
                    </>
                  ) : (
                    <>
                      <DetailRow label="Tanggal lahir">{newPatient.birthDate || 'Belum diisi'}</DetailRow>
                      <DetailRow label="Desa">
                        {newPatient.village}, {newPatient.district}
                      </DetailRow>
                      <DetailRow label="Status">
                        <span className="text-ct-700">Akan didaftarkan saat dikirim</span>
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
                  <DetailRow label="Berat badan">
                    {vitals.weightKg ? `${vitals.weightKg} kg` : 'Belum diisi'}
                  </DetailRow>
                  <DetailRow label="Suhu tubuh">
                    {vitals.temperatureC ? `${vitals.temperatureC} °C` : 'Tidak dicatat'}
                  </DetailRow>
                  <DetailRow label="Batuk">
                    {symptoms.coughWeeks > 0
                      ? `${symptoms.coughWeeks} minggu`
                      : 'Tidak ada keluhan'}
                  </DetailRow>
                  <DetailRow label="Gejala lain">
                    {BOOLEAN_SYMPTOMS.filter((key) => symptoms[key]).length === 0
                      ? 'Tidak ada keluhan'
                      : BOOLEAN_SYMPTOMS.filter((key) => symptoms[key])
                          .map((key) => symptomLabel[key] ?? key)
                          .join(', ')}
                  </DetailRow>
                  <DetailRow label="Kualitas gambar">
                    <ImageQualityBadge quality={imageQuality} size="sm" />
                  </DetailRow>
                  <DetailRow label="X-ray">
                    {image ? (
                      <span className="truncate">{image.meta.fileName}</span>
                    ) : (
                      <span className="text-attention-800">Belum dilampirkan</span>
                    )}
                  </DetailRow>
                </dl>
              </section>
            </div>

            {analysisProgress !== null ? (
              <div className="rounded-md border border-ct-200 bg-ct-50 px-3.5 py-3">
                <ProgressBar
                  value={analysisProgress}
                  label="Menjalankan model screening"
                />
                <p className="mt-2 text-xs text-obsidian-600">
                  X-ray sudah disimpan dan sedang dikirim ke model screening. Kalau belum ada model
                  yang terhubung, record langsung diteruskan ke tenaga medis untuk review.
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
            Kembali
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={submitting}
              leadingIcon={<Save className="size-4" />}
              onClick={() => void submit(true)}
            >
              Simpan sebagai draf
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                variant="primary"
                onClick={goNext}
                disabled={submitting}
                trailingIcon={<ArrowRight className="size-4" />}
              >
                Lanjut
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
                {connected ? 'Kirim screening' : 'Simpan dan antrekan'}
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
