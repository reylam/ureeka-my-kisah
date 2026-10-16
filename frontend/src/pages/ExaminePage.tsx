import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardList, ListOrdered, Pencil, ScanLine, UserRound } from 'lucide-react';
import { PageHeader, HeaderMeta } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { Skeleton } from '@/components/ui/Skeleton';
import { Field, Fieldset } from '@/components/forms/Field';
import { Checkbox, RadioGroup, Select, TextInput } from '@/components/forms/Inputs';
import { PatientFields } from '@/components/patients/PatientFields';
import {
  draftFromPatient,
  patientInputFromDraft,
  validatePatientDraft,
  type PatientDraft,
  type PatientDraftErrors,
} from '@/components/patients/patientDraft';
import { XrayDropzone } from '@/components/screening/XrayDropzone';
import { ProbabilityPanel } from '@/components/screening/ProbabilityPanel';
import { AccessCodeCard } from '@/components/screening/AccessCodeCard';
import { ScreeningOutcomeBadge } from '@/components/ui/StatusBadge';
import { GroundedRegions } from '@/trace/components/demo/GroundedRegions';
import { useImageUpload } from '@/trace/hooks/useImageUpload';
import { useScreeningImage } from '@/hooks/useScreeningImage';
import type { ImageQuality, QueuePriority, Screening, ScreeningVitals, SymptomSet } from '@/types/domain';
import {
  getScreening,
  recordAnalysis,
  saveExamination,
  startExamination,
  submitScreening,
  updatePatient,
  uploadImage,
} from '@/services/recordsApi';
import { localModelSupported, preloadLocalModel, screenImageLocally } from '@/services/localModel';
import { errorMessage } from '@/lib/apiClient';
import { PRIORITY_HINT, PRIORITY_LABEL, PRIORITY_ORDER, suggestPriority } from '@/lib/queue';
import { toast } from '@/stores/toastStore';
import { ageFromBirthDate, formatDate, formatTime } from '@/utils/date';
import { imageQualityLabel, screeningOutcomeMeaning, sexLabel, symptomLabel } from '@/utils/labels';

/**
 * The radiologist's examination of one request, on one page:
 *
 *   1. the patient's data, which the radiologist can complete or correct
 *   2. symptoms and vitals
 *   3. the X-ray, which the model running in this browser reads when the
 *      radiologist presses "Periksa": three scores, and boxes on the areas it
 *      leaned on, each grounded to a class
 *   4. the priority, the model's suggestion first and the radiologist's call
 *      last, then "Kirim ke sistem", which allocates the queue number
 *
 * Opening the page takes the request (start_screening), so no other
 * radiologist works on it at the same time. Everything is saved on the record
 * as it goes, so leaving and coming back continues where it stopped.
 */

type Phase = 'editing' | 'checking' | 'checked' | 'submitting' | 'done';

const BOOLEAN_SYMPTOMS = ['hemoptysis', 'nightSweats', 'weightLoss', 'fever', 'chestPain', 'fatigue', 'appetiteLoss'] as const;

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

interface VitalsDraft {
  weightKg: string;
  heightCm: string;
  temperatureC: string;
  respiratoryRate: string;
}

const VITAL_FIELDS: { key: keyof VitalsDraft; label: string; unit: string; min: number; max: number; step: string }[] = [
  { key: 'weightKg', label: 'Berat badan', unit: 'kg', min: 1, max: 500, step: '0.1' },
  { key: 'heightCm', label: 'Tinggi badan', unit: 'cm', min: 20, max: 260, step: '0.1' },
  { key: 'temperatureC', label: 'Suhu', unit: '°C', min: 30, max: 45, step: '0.1' },
  { key: 'respiratoryRate', label: 'Laju napas', unit: '/menit', min: 4, max: 90, step: '1' },
];

const vitalsDraftFrom = (vitals: ScreeningVitals | null): VitalsDraft => ({
  weightKg: vitals?.weightKg != null ? String(vitals.weightKg) : '',
  heightCm: vitals?.heightCm != null ? String(vitals.heightCm) : '',
  temperatureC: vitals?.temperatureC != null ? String(vitals.temperatureC) : '',
  respiratoryRate: vitals?.respiratoryRate != null ? String(vitals.respiratoryRate) : '',
});

/** Blank is allowed (null); anything else must be a number in range. */
function parseVitals(draft: VitalsDraft) {
  const vitals: ScreeningVitals = { weightKg: null, heightCm: null, temperatureC: null, respiratoryRate: null };
  const errors: Partial<Record<keyof VitalsDraft, string>> = {};
  for (const field of VITAL_FIELDS) {
    const raw = draft[field.key].trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < field.min || value > field.max) {
      errors[field.key] = `Isi angka ${field.min} sampai ${field.max}, atau kosongkan.`;
    } else {
      vitals[field.key] = value;
    }
  }
  return { vitals, errors };
}

export function ExaminePage() {
  const { screeningId = '' } = useParams();
  const navigate = useNavigate();

  const [screening, setScreening] = useState<Screening | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* Patient */
  const [editingPatient, setEditingPatient] = useState(false);
  const [patientDraft, setPatientDraft] = useState<PatientDraft | null>(null);
  const [patientErrors, setPatientErrors] = useState<PatientDraftErrors>({});
  const [savingPatient, setSavingPatient] = useState(false);

  /* Symptoms, vitals, image */
  const [symptoms, setSymptoms] = useState<SymptomSet>(EMPTY_SYMPTOMS);
  const [vitals, setVitals] = useState<VitalsDraft>(vitalsDraftFrom(null));
  const [vitalErrors, setVitalErrors] = useState<Partial<Record<keyof VitalsDraft, string>>>({});
  const [imageQuality, setImageQuality] = useState<ImageQuality>('adequate');
  const upload = useImageUpload();
  const stored = useScreeningImage(upload.image ? null : screening);
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null);

  /* Progress */
  const [phase, setPhase] = useState<Phase>('editing');
  const [step, setStep] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [modelNote, setModelNote] = useState<string | null>(null);
  const [priority, setPriority] = useState<QueuePriority | null>(null);

  useEffect(() => preloadLocalModel(), []);

  /** Load the request and take it. A submitted one opens read-only elsewhere. */
  const open = useCallback(async () => {
    setLoadError(null);
    try {
      let record = await getScreening(screeningId);
      if (record.status === 'queued' || record.status === 'served') {
        navigate(`/screenings/${record.id}`, { replace: true });
        return;
      }
      if (record.status === 'waiting' && record.patient) record = await startExamination(record.id);
      setScreening(record);
      setSymptoms(record.symptoms ?? EMPTY_SYMPTOMS);
      setVitals(vitalsDraftFrom(record.vitals));
      setImageQuality(record.imageQuality);
      // Coming back to a record that was already read: carry on from priority.
      if (record.hasImage && record.analysis) {
        setPhase('checked');
        setPriority(suggestPriority(record.analysis).priority);
      }
    } catch (cause) {
      setLoadError(errorMessage(cause, 'Pendaftaran ini gagal dibuka.'));
    }
  }, [screeningId, navigate]);

  useEffect(() => {
    void open();
  }, [open]);

  const locked = phase === 'checking' || phase === 'submitting';
  const analysis = screening?.analysis ?? null;
  const suggestion = useMemo(() => suggestPriority(analysis), [analysis]);

  /** Any edit after a check means the check no longer describes what is on screen. */
  const touched = () => {
    setPhase((current) => (current === 'checked' ? 'editing' : current));
    setFailure(null);
  };

  const savePatient = async () => {
    if (!screening?.patient || !patientDraft) return;
    const found = validatePatientDraft(patientDraft);
    setPatientErrors(found);
    if (Object.keys(found).length > 0) return;
    setSavingPatient(true);
    try {
      const patient = await updatePatient(screening.patient.id, patientInputFromDraft(patientDraft));
      setScreening({ ...screening, patient });
      setEditingPatient(false);
      toast.success('Data pasien diperbarui.');
    } catch (cause) {
      toast.error('Data pasien belum tersimpan.', errorMessage(cause));
    } finally {
      setSavingPatient(false);
    }
  };

  const check = async () => {
    if (!screening) return;
    const parsed = parseVitals(vitals);
    setVitalErrors(parsed.errors);
    const needsImage = !upload.image && !screening.hasImage;
    if (Object.keys(parsed.errors).length > 0 || needsImage) {
      setFailure(needsImage ? 'Pilih rontgen dada dulu.' : 'Ada isian yang perlu diperbaiki. Lihat bagian yang ditandai.');
      return;
    }

    setFailure(null);
    setModelNote(null);
    setPhase('checking');
    try {
      setStep('Menyimpan data pemeriksaan');
      let record = await saveExamination(screening.id, { symptoms, vitals: parsed.vitals, imageQuality });

      const file = upload.image?.file ?? null;
      if (file) {
        setStep('Mengunggah rontgen');
        record = await uploadImage(record.id, file);
      }

      // The model reads the file in this browser. Without a fresh file (coming
      // back to a stored image) or without WebAssembly, the radiologist sets
      // the priority alone; a model failure does not undo the upload.
      if (file && localModelSupported()) {
        try {
          const result = await screenImageLocally(file, {
            onStage: (stage) => setStep(stage === 'analyse' ? 'Model membaca rontgen' : 'Mencari area yang dipakai model'),
          });
          setStep('Menyimpan hasil model');
          record = await recordAnalysis(record.id, {
            probabilities: result.analysis.probabilities,
            model: { name: result.analysis.model.name, version: result.analysis.model.version, backbone: result.analysis.model.backbone },
            regions: result.analysis.regions,
          });
          setHeatmapUrl(result.heatmapUrl);
        } catch (cause) {
          setModelNote(`Model belum bisa membaca rontgen ini (${errorMessage(cause)}). Prioritas tetap bisa kamu tentukan sendiri.`);
        }
      } else if (file) {
        setModelNote('Browser ini tidak bisa menjalankan model. Prioritas tetap bisa kamu tentukan sendiri.');
      }

      setScreening(record);
      setPriority(suggestPriority(record.analysis).priority);
      setPhase('checked');
    } catch (cause) {
      setFailure(errorMessage(cause, 'Pemeriksaan gagal.'));
      setPhase('editing');
    } finally {
      setStep(null);
    }
  };

  const submit = async () => {
    if (!screening || !priority) return;
    setPhase('submitting');
    setFailure(null);
    try {
      const result = await submitScreening(screening.id, priority);
      setScreening(result);
      setPhase('done');
      toast.success('Terkirim ke sistem.', `Nomor antrean ${result.queueNumber}`);
    } catch (cause) {
      setFailure(errorMessage(cause, 'Screening belum terkirim.'));
      setPhase('checked');
    }
  };

  /* ── Loading and refusals ───────────────────────────────────────────────── */

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <ErrorState title="Pemeriksaan tidak bisa dibuka" description={loadError} onRetry={() => void open()} />
        <p className="text-center">
          <Link to="/requests" className="text-[13px] text-obsidian-500 underline underline-offset-2">
            Kembali ke pendaftaran
          </Link>
        </p>
      </div>
    );
  }
  if (!screening) {
    return (
      <div className="mx-auto max-w-3xl space-y-5" role="status" aria-label="Memuat pemeriksaan">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-48" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (!screening.patient) {
    return (
      <div className="mx-auto max-w-xl">
        <Notice tone="attention" title="Simpan data pasien terlebih dahulu">
          Pendaftaran ini berasal dari formulir publik dan belum dicocokkan dengan rekam medis.{' '}
          <Link to="/requests" className="font-medium underline underline-offset-2">
            Simpan datanya di halaman pendaftaran
          </Link>
          , lalu buka lagi.
        </Notice>
      </div>
    );
  }

  const patient = screening.patient;

  /* ── Done ───────────────────────────────────────────────────────────────── */

  if (phase === 'done') {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader title="Terkirim ke sistem" description={`${patient.name} sudah masuk antrean.`} />
        <Notice tone="info" title="Hasil awal sudah bisa dilihat pasien">
          Halaman Cek Hasil pasien memperbarui dirinya sendiri, jadi nomor antrean dan hasil awal muncul di sana tanpa
          perlu kode baru.
        </Notice>
        <AccessCodeCard screening={screening} />
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/requests" variant="primary" leadingIcon={<ClipboardList className="mr-1.5 size-4" />}>
            Pendaftaran berikutnya
          </ButtonLink>
          <ButtonLink to="/queue" leadingIcon={<ListOrdered className="mr-1.5 size-4" />}>
            Lihat antrean
          </ButtonLink>
        </div>
      </div>
    );
  }

  /* ── The examination ────────────────────────────────────────────────────── */

  const imageUrl = upload.image?.url ?? stored.url;
  const imageName = upload.image?.file.name ?? screening.imageMeta?.fileName ?? 'rontgen';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={patient.name}
        description="Periksa rontgen sambil melengkapi data pasien, tentukan prioritas, lalu kirim ke sistem."
        meta={
          <>
            <HeaderMeta label="No. rekam medis" value={patient.mrn} />
            <HeaderMeta label="Daftar" value={`${formatDate(screening.requestDate)}, ${formatTime(screening.requestedAt)}`} />
          </>
        }
      />

      {failure ? (
        <Notice tone="urgent" title="Belum berhasil">
          {failure}
        </Notice>
      ) : null}

      {/* 1. Patient */}
      <Card>
        <CardHeader
          title="1 · Data pasien"
          icon={<UserRound />}
          actions={
            editingPatient ? null : (
              <Button
                size="sm"
                variant="ghost"
                disabled={locked}
                leadingIcon={<Pencil className="mr-1.5 size-3.5" />}
                onClick={() => {
                  setPatientDraft(draftFromPatient(patient));
                  setPatientErrors({});
                  setEditingPatient(true);
                }}
              >
                Ubah
              </Button>
            )
          }
        />
        <CardBody className="space-y-3">
          {editingPatient && patientDraft ? (
            <>
              <PatientFields
                draft={patientDraft}
                errors={patientErrors}
                disabled={savingPatient}
                onChange={(patch) => setPatientDraft((current) => (current ? { ...current, ...patch } : current))}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="primary" loading={savingPatient} onClick={() => void savePatient()}>
                  Simpan data pasien
                </Button>
                <Button size="sm" variant="ghost" disabled={savingPatient} onClick={() => setEditingPatient(false)}>
                  Batal
                </Button>
              </div>
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-obsidian-700">
              {sexLabel[patient.sex]} · {ageFromBirthDate(patient.birthDate)} tahun (lahir {formatDate(patient.birthDate)})
              {patient.phone ? ` · ${patient.phone}` : ''}
              {patient.address ? ` · ${patient.address}` : ''}
            </p>
          )}
          {screening.complaint ? (
            <p className="rounded-md bg-obsidian-50 px-3 py-2 text-[13px] text-obsidian-700">
              <span className="font-medium text-obsidian-900">Keluhan saat mendaftar:</span> {screening.complaint}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {/* 2. Symptoms and vitals */}
      <Card>
        <CardHeader title="2 · Gejala dan tanda vital" icon={<ClipboardList />} />
        <CardBody className="space-y-5">
          <Field label="Lama batuk" hint="Isi 0 kalau pasien tidak batuk.">
            {({ id, describedBy }) => (
              <div className="flex items-center gap-2">
                <TextInput
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={520}
                  value={symptoms.coughWeeks}
                  disabled={locked}
                  describedBy={describedBy}
                  onChange={(event) => {
                    setSymptoms((current) => ({
                      ...current,
                      coughWeeks: Math.max(0, Math.min(520, Math.trunc(Number(event.target.value) || 0))),
                    }));
                    touched();
                  }}
                  className="w-28"
                />
                <span className="text-[13px] text-obsidian-500">minggu</span>
              </div>
            )}
          </Field>

          <Fieldset legend="Keluhan lain" hint="Centang yang dialami pasien.">
            <div className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
              {BOOLEAN_SYMPTOMS.map((key) => (
                <Checkbox
                  key={key}
                  label={symptomLabel[key]}
                  checked={symptoms[key]}
                  disabled={locked}
                  onChange={(on) => {
                    setSymptoms((current) => ({ ...current, [key]: on }));
                    touched();
                  }}
                />
              ))}
            </div>
          </Fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            {VITAL_FIELDS.map((field) => (
              <Field key={field.key} label={field.label} error={vitalErrors[field.key] ?? null} optional>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    type="number"
                    inputMode="decimal"
                    step={field.step}
                    value={vitals[field.key]}
                    disabled={locked}
                    describedBy={describedBy}
                    invalid={invalid}
                    suffix={field.unit}
                    onChange={(event) => {
                      setVitals((current) => ({ ...current, [field.key]: event.target.value }));
                      touched();
                    }}
                  />
                )}
              </Field>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* 3. The X-ray */}
      <Card>
        <CardHeader
          title="3 · Rontgen dada"
          icon={<ScanLine />}
          description="Model yang berjalan di browser ini membaca gambarnya setelah kamu menekan Periksa, lalu menandai area yang paling memengaruhi hasilnya."
        />
        <CardBody className="space-y-4">
          {upload.image || !screening.hasImage ? (
            <XrayDropzone
              image={upload.image}
              error={upload.error}
              reading={upload.isReading}
              disabled={locked}
              onSelect={(file) => {
                upload.select(file);
                setHeatmapUrl(null);
                touched();
              }}
              onClear={() => {
                upload.clear();
                touched();
              }}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-obsidian-200 px-3 py-2 text-[13px] text-obsidian-600">
              <span>Rontgen sudah terunggah: {screening.imageMeta?.fileName ?? 'gambar'}</span>
              <label className="cursor-pointer font-medium text-ct-700 underline underline-offset-2">
                Ganti gambar
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="sr-only"
                  disabled={locked}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      upload.select(file);
                      setHeatmapUrl(null);
                      touched();
                    }
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
          )}

          <Field label="Kualitas gambar menurut dokter">
            {({ id, describedBy }) => (
              <Select
                id={id}
                value={imageQuality}
                disabled={locked}
                describedBy={describedBy}
                onChange={(event) => {
                  setImageQuality(event.target.value as ImageQuality);
                  touched();
                }}
                className="max-w-xs"
              >
                {(Object.keys(imageQualityLabel) as ImageQuality[]).map((quality) => (
                  <option key={quality} value={quality}>
                    {imageQualityLabel[quality]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              loading={phase === 'checking'}
              disabled={locked || phase === 'checked'}
              onClick={() => void check()}
              trailingIcon={<ArrowRight className="size-4" />}
            >
              {phase === 'checking' ? (step ?? 'Memeriksa') : screening.hasImage ? 'Periksa ulang' : 'Periksa rontgen'}
            </Button>
            {phase === 'checked' ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-complete-700">
                <CheckCircle2 aria-hidden className="size-4" />
                Sudah diperiksa. Ubah isian apa pun untuk memeriksa ulang.
              </span>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {/* 4. Priority, then submit */}
      {phase === 'checked' || phase === 'submitting' ? (
        <Card>
          <CardHeader
            title="4 · Cek prioritas"
            icon={<ListOrdered />}
            description="Saran dari model hanya titik awal. Prioritas akhir adalah keputusan dokter."
          />
          <CardBody className="space-y-5">
            {analysis ? (
              <div className="space-y-4">
                <ScreeningOutcomeBadge outcome={analysis.outcome} />
                <p className="text-[13px] leading-relaxed text-obsidian-700">{screeningOutcomeMeaning[analysis.outcome]}</p>
                {analysis.predictedLabel !== 'Healthy' && imageUrl ? (
                  <GroundedRegions
                    imageUrl={imageUrl}
                    imageName={imageName}
                    regions={analysis.regions}
                    heatmapUrl={heatmapUrl}
                    note={analysis.detectionNote}
                  />
                ) : null}
                <ProbabilityPanel analysis={analysis} />
              </div>
            ) : (
              <Notice tone="attention" title="Tidak ada hasil model">
                {modelNote ?? 'Model belum membaca rontgen ini.'}
              </Notice>
            )}

            <Fieldset legend="Prioritas antrean" hint={`Saran: ${PRIORITY_LABEL[suggestion.priority].toLowerCase()}. ${suggestion.reason}`}>
              <RadioGroup
                name="priority"
                value={priority}
                onChange={setPriority}
                options={PRIORITY_ORDER.map((value) => ({
                  value,
                  label: `${PRIORITY_LABEL[value]}${value === suggestion.priority ? ' (saran)' : ''}`,
                  description: PRIORITY_HINT[value],
                }))}
              />
            </Fieldset>

            <div className="flex flex-wrap items-center gap-3 border-t border-obsidian-100 pt-4">
              <Button
                variant="primary"
                size="lg"
                loading={phase === 'submitting'}
                disabled={!priority || phase === 'submitting'}
                onClick={() => void submit()}
                trailingIcon={<ArrowRight className="size-4" />}
              >
                Kirim ke sistem
              </Button>
              <p className="text-xs text-obsidian-500">
                Setelah dikirim, data tidak bisa diubah. Pasien mendapat nomor antrean dan hasil awalnya di halaman Cek Hasil.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <p className="text-center text-xs text-obsidian-500">Hasil model adalah alat bantu screening, bukan diagnosis.</p>
    </div>
  );
}
