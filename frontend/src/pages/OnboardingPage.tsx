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
import { errorMessage } from '@/lib/apiClient';
import {
  completeOnboarding,
  saveOnboardingAddress,
  saveOnboardingHealth,
  saveOnboardingPersonal,
} from '@/services/onboardingApi';
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
  { id: 'personal', label: 'Tentang kamu', hint: 'Nama, tanggal lahir, kontak' },
  { id: 'address', label: 'Tempat tinggal', hint: 'Untuk fasilitas terdekat' },
  { id: 'health', label: 'Detail kesehatan', hint: 'Opsional' },
  { id: 'consent', label: 'Review', hint: 'Cek dan konfirmasi' },
];

const SYMPTOM_OPTIONS = [
  { id: 'cough', label: 'Batuk yang tidak kunjung sembuh' },
  { id: 'blood', label: 'Batuk berdarah' },
  { id: 'night-sweats', label: 'Keringat malam' },
  { id: 'weight-loss', label: 'Berat badan turun tanpa sebab jelas' },
  { id: 'fever', label: 'Demam' },
  { id: 'chest-pain', label: 'Nyeri dada' },
  { id: 'fatigue', label: 'Lelah yang tidak biasa' },
  { id: 'appetite', label: 'Nafsu makan menurun' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const account = useCurrentAccount();
  const signOut = useAuthStore((state) => state.signOut);
  const [saving, setSaving] = useState(false);

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
      if (personal.fullName.trim().length < 2) next.fullName = 'Isi nama lengkapmu.';
      if (!personal.birthDate) next.birthDate = 'Isi tanggal lahirmu.';
      else if (new Date(personal.birthDate) > new Date())
        next.birthDate = 'Tanggal ini belum terjadi.';
      if (personal.phone.replace(/\D/g, '').length < 8)
        next.phone = 'Isi nomor telepon yang bisa kami hubungi.';
    }

    if (step === 1) {
      if (!address.district) next.district = 'Pilih kecamatanmu.';
      if (!address.village) next.village = 'Pilih desa atau kelurahanmu.';
    }

    if (step === 3 && !consent.dataUse) {
      next.consent = 'Kami butuh persetujuanmu untuk hal dasar ini sebelum akun bisa dipakai.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Each step is saved to the server before moving on, so the wizard resumes
  // where it was left and nothing is held only in this tab.
  const goNext = async () => {
    if (saving || !validateStep()) return;

    setSaving(true);
    try {
      if (step === 0) {
        await saveOnboardingPersonal({
          fullName: personal.fullName.trim(),
          birthDate: personal.birthDate,
          phone: personal.phone.trim(),
          sex: personal.sex,
        });
      }
      if (step === 1) await saveOnboardingAddress({ ...address });
      if (step === 2) await saveOnboardingHealth(health);

      if (step === 3) {
        await completeOnboarding({
          dataUse: consent.dataUse,
          // Only meaningful if they actually shared anything in step 3.
          healthInfo: health.shared ? consent.healthInfo : false,
        });
        toast.success('Semua sudah siap.');
        navigate('/me', { replace: true });
        return;
      }

      setStep(step + 1);
    } catch (cause) {
      toast.error('Langkah ini gagal disimpan.', errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const skipHealth = async () => {
    const declined: OnboardingHealth = {
      symptoms: [],
      symptomWeeks: null,
      priorTb: 'prefer-not-to-say',
      householdContact: null,
      notes: '',
      shared: false,
    };
    setSaving(true);
    try {
      await saveOnboardingHealth(declined);
      setHealth(declined);
      setStep(3);
    } catch (cause) {
      toast.error('Pilihanmu gagal disimpan.', errorMessage(cause));
    } finally {
      setSaving(false);
    }
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
            Selesaikan nanti
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-xl font-semibold text-obsidian-950">
          Selamat datang, {account.name.split(' ')[0]}
        </h1>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-obsidian-600">
          Beberapa detail agar record kamu lengkap dan kami bisa mengarahkanmu ke fasilitas
          terdekat. Semua ini bisa kamu ubah nanti lewat profil.
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
              <CardHeader title="Tentang kamu" description="Wajib diisi, supaya record kamu bisa dikenali." />
              <CardBody className="space-y-4">
                <Field label="Nama lengkap" error={errors.fullName ?? null} required>
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
                    label="Tanggal lahir"
                    hint="Dipakai untuk menentukan kelompok usia, yang memengaruhi panduan screening."
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

                  <Field label="Nomor telepon" error={errors.phone ?? null} required>
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
                  label="Jenis kelamin"
                  hint="Opsional. TB bisa muncul berbeda antar kelompok, jadi ini membantu petugas yang membaca record kamu."
                >
                  {() => (
                    <RadioGroup
                      name="sex"
                      value={personal.sex}
                      onChange={(value) => setPersonal((c) => ({ ...c, sex: value }))}
                      options={[
                        { value: 'female', label: 'Perempuan' },
                        { value: 'male', label: 'Laki-laki' },
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
                title="Tempat tinggal"
                description="Secukupnya saja, untuk menampilkan fasilitas terdekat."
              />
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Provinsi">
                    {({ id }) => <TextInput id={id} value={address.province} readOnly disabled />}
                  </Field>

                  <Field label="Kecamatan" error={errors.district ?? null} required>
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
                        <option value="">Pilih kecamatan</option>
                        {DISTRICTS.map((district) => (
                          <option key={district} value={district}>
                            {district}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>

                <Field label="Desa atau kelurahan" error={errors.village ?? null} required>
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
                        {address.district ? 'Pilih desa' : 'Pilih kecamatan dulu'}
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
                  label="Alamat jalan"
                  hint="Opsional. Hanya perlu kalau petugas kesehatan mungkin harus berkunjung."
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
                title="Detail kesehatan"
                description="Sepenuhnya opsional. Lewati seluruh langkah ini kalau kamu tidak ingin mengisi."
              />
              <CardBody className="space-y-5">
                <Notice tone="info" title="Kenapa kami bertanya">
                  <p>
                    Gejala sering lebih penting daripada gambar. X-ray dada bisa tampak normal pada
                    orang yang sebenarnya terkena TB, jadi siapa pun yang membaca record kamu perlu
                    tahu apa yang kamu rasakan. Hanya tenaga kesehatan yang ditugaskan untuk
                    perawatanmu yang bisa melihat jawaban ini, dan kamu bisa mengubah atau menariknya
                    kapan saja.
                  </p>
                </Notice>

                <Field
                  label="Pernahkah kamu mengalami salah satu dari ini?"
                  hint="Centang yang sesuai. Ini bukan diagnosis."
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
                    label="Kira-kira sudah berapa minggu?"
                    hint="Batuk lebih dari dua minggu biasanya jadi alasan untuk periksa."
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

                <Field label="Pernahkah kamu menjalani pengobatan TB sebelumnya?">
                  {() => (
                    <RadioGroup
                      name="priorTb"
                      value={health.priorTb}
                      onChange={(value) => setHealth((c) => ({ ...c, shared: true, priorTb: value }))}
                      options={[
                        { value: 'never', label: 'Tidak, belum pernah' },
                        { value: 'treated', label: 'Pernah, dan pengobatan sudah selesai' },
                        { value: 'ongoing', label: 'Ya, sedang menjalani pengobatan' },
                        { value: 'prefer-not-to-say', label: 'Lebih baik tidak dijawab' },
                      ]}
                    />
                  )}
                </Field>

                <Field label="Ada hal lain yang ingin dicatat di record kamu?">
                  {({ id }) => (
                    <TextArea
                      id={id}
                      rows={3}
                      value={health.notes}
                      onChange={(event) => setHealth((c) => ({ ...c, notes: event.target.value }))}
                      placeholder="Opsional"
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
                title="Cek dan konfirmasi"
                description="Kembali ke langkah mana pun untuk mengubah jawaban."
              />
              <CardBody className="space-y-5">
                <dl className="divide-y divide-obsidian-100">
                  <DetailRow label="Nama">{personal.fullName || '—'}</DetailRow>
                  <DetailRow label="Tanggal lahir">
                    {personal.birthDate ? formatDate(personal.birthDate) : '—'}
                  </DetailRow>
                  <DetailRow label="Telepon">{personal.phone || '—'}</DetailRow>
                  <DetailRow label="Tempat tinggal">
                    {[address.village, address.district, address.province]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </DetailRow>
                  <DetailRow label="Detail kesehatan">
                    {health.shared
                      ? health.symptoms.length > 0
                        ? `${health.symptoms.length} gejala dilaporkan`
                        : 'Sudah dijawab, tidak ada gejala dilaporkan'
                      : 'Tidak dibagikan'}
                  </DetailRow>
                </dl>

                <div className="space-y-3 rounded-card border border-obsidian-200 bg-obsidian-50 p-4">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-obsidian-900">
                    <Lock aria-hidden className="size-3.5 text-ct-700" />
                    Bagaimana informasimu dipakai
                  </p>
                  <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-obsidian-600">
                    <li>Nama dan kontakmu dipakai untuk mengenali record kamu dan agar petugas kesehatan bisa menghubungimu.</li>
                    <li>Hanya tenaga profesional yang ditugaskan untuk perawatanmu yang bisa membuka record kamu.</li>
                    <li>Pasien lain tidak akan pernah bisa melihat informasimu.</li>
                    <li>Kamu bisa mengubah atau menarik jawaban kesehatanmu dari profil kapan saja.</li>
                  </ul>

                  <div className="space-y-2.5 pt-1">
                    <Checkbox
                      label="Saya setuju nama, kontak, dan alamat saya dipakai untuk mengelola akun dan perawatan saya."
                      checked={consent.dataUse}
                      onChange={(checked) => {
                        setConsent((c) => ({ ...c, dataUse: checked }));
                        setErrors((c) => ({ ...c, consent: '' }));
                      }}
                    />
                    {health.shared ? (
                      <Checkbox
                        label="Saya setuju jawaban kesehatan saya dibagikan ke tenaga kesehatan yang ditugaskan untuk perawatan saya."
                        description="Opsional. Kalau menolak, akunmu tetap aktif; jawabannya hanya tidak dibagikan."
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
                  PARUPINTAS tidak mendiagnosis tuberkulosis. Semua yang ditampilkan hanya membantu kamu
                  memutuskan perlu tes atau tidak, dan menyimpan record kamu dalam satu tempat.
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
            Kembali
          </Button>

          <div className="flex items-center gap-2">
            {step === 2 ? (
              <Button variant="outline" onClick={skipHealth}>
                Lewati langkah ini
              </Button>
            ) : null}
            <Button
              variant="primary"
              onClick={goNext}
              trailingIcon={
                step === 3 ? <Check className="size-4" /> : <ArrowRight className="size-4" />
              }
            >
              {step === 3 ? 'Selesai' : 'Lanjut'}
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-obsidian-500">
          Jawabanmu tersimpan otomatis, jadi kamu bisa menutup halaman ini dan kembali lagi nanti.
        </p>
      </main>
    </div>
  );
}
