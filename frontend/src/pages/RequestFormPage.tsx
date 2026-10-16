import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ClipboardCheck, Copy, Loader2, ShieldAlert } from 'lucide-react';
import { Container } from '@/trace/components/ui/Container';
import { Eyebrow } from '@/trace/components/ui/SectionHeading';
import { TraceButton } from '@/trace/components/ui/TraceButton';
import { DisclaimerBanner } from '@/trace/components/ui/DisclaimerBanner';
import {
  EMPTY_PATIENT_DRAFT,
  patientInputFromDraft,
  validatePatientDraft,
  type PatientDraft,
  type PatientDraftErrors,
} from '@/components/patients/patientDraft';
import type { RequestReceipt } from '@/types/domain';
import { ApiError } from '@/lib/apiClient';
import { formatAccessCode } from '@/lib/queue';
import { sendRequest } from '@/services/recordsApi';
import { rememberCode } from './PatientResultPage';
import { cn } from '@/utils/cn';

/**
 * The request form. A patient has no account: they fill this in, at home or at
 * the clinic, and get an access code (voucher) back. With the code they follow
 * the request on "Cek Hasil" until the radiologist has checked their X-ray and
 * the initial result and queue number are out.
 *
 * Only what the desk needs to find or save their record is asked for, plus the
 * reason they came. Nothing here is a diagnosis or asks for one.
 */

const inputClass =
  'block h-11 w-full rounded-xl border border-trace-line bg-trace-card px-3.5 text-[15px] text-trace-text placeholder:text-trace-dim focus:border-trace-accent focus:outline-none aria-[invalid=true]:border-trace-flag';

function FormField({
  id,
  label,
  error,
  optional = false,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-baseline gap-2 text-[13.5px] font-medium text-trace-text">
        {label}
        {optional ? <span className="text-[12px] font-normal text-trace-dim">opsional</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[12.5px] text-trace-flag">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RequestFormPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<PatientDraft>(EMPTY_PATIENT_DRAFT);
  const [complaint, setComplaint] = useState('');
  const [errors, setErrors] = useState<PatientDraftErrors>({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<RequestReceipt | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = 'Daftar Periksa · PARUPINTAS';
  }, []);

  const change = (patch: Partial<PatientDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const invalid = (field: keyof PatientDraft) => (errors[field] ? true : undefined);
  const described = (field: keyof PatientDraft) => (errors[field] ? `${field}-error` : undefined);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validatePatientDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0 || sending) return;

    setSending(true);
    setFailure(null);
    try {
      const result = await sendRequest({ ...patientInputFromDraft(draft), complaint: complaint.trim() });
      rememberCode(result.code);
      setReceipt(result);
      window.scrollTo({ top: 0 });
    } catch (cause) {
      setFailure(
        cause instanceof ApiError && cause.status === 429
          ? cause.message
          : cause instanceof ApiError && cause.status === 0
            ? 'Server tidak bisa dihubungi. Periksa koneksi lalu coba lagi.'
            : 'Pendaftaran belum terkirim. Periksa isian lalu coba lagi.',
      );
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    if (!receipt) return;
    try {
      await navigator.clipboard.writeText(formatAccessCode(receipt.code));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // The code is on screen; copying is a convenience.
    }
  };

  /* ── After sending: the voucher ─────────────────────────────────────────── */

  if (receipt) {
    return (
      <div className="border-b border-trace-line">
        <Container width="narrow" className="py-14 sm:py-16">
          <Eyebrow>Pendaftaran terkirim</Eyebrow>
          <h1 className="mt-5 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[38px]">
            Simpan kode aksesmu
          </h1>
          <p className="mt-5 text-[15.5px] leading-7 text-trace-muted">
            Kode ini adalah voucher untuk mengambil hasilmu. Tunjukkan ke petugas saat datang, dan pakai di halaman
            Cek Hasil untuk melihat statusnya. Catat atau foto layar ini: kode tidak bisa dikirim ulang.
          </p>

          <section
            aria-label="Kode akses"
            className="mt-8 overflow-hidden rounded-md border border-trace-accent-edge bg-trace-card"
          >
            <div className="bg-trace-accent-surface px-5 py-7 text-center sm:px-7">
              <p className="trace-label text-trace-accent-soft">Kode akses</p>
              <p className="mt-3 font-mono text-[44px] leading-none font-semibold tracking-[0.12em] text-trace-text sm:text-[56px]">
                {formatAccessCode(receipt.code)}
              </p>
              <button
                type="button"
                onClick={() => void copy()}
                className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-trace-accent-edge bg-trace-card px-3.5 py-1.5 text-[13px] text-trace-accent-soft transition-colors hover:border-trace-accent"
              >
                {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
                {copied ? 'Tersalin' : 'Salin kode'}
              </button>
            </div>
            <ol className="space-y-3 px-5 py-6 text-[14px] leading-6 text-trace-muted sm:px-7">
              {[
                'Datang ke klinik dan sebutkan kode ini di meja pendaftaran.',
                'Dokter radiologi memeriksa rontgen dadamu dan menentukan prioritas antrean.',
                'Buka Cek Hasil dengan kode ini. Statusnya diperbarui sendiri, sampai hasil awal dan nomor antreanmu keluar.',
              ].map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-trace-line font-mono text-[11px] text-trace-dim">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          <div className="mt-6 flex flex-wrap gap-3">
            <TraceButton onClick={() => navigate('/hasil', { state: { code: receipt.code } })}>
              Cek status sekarang
              <ArrowRight aria-hidden className="size-4" />
            </TraceButton>
          </div>
        </Container>
      </div>
    );
  }

  /* ── The form ──────────────────────────────────────────────────────────── */

  return (
    <div className="border-b border-trace-line">
      <Container width="narrow" className="py-14 sm:py-16">
        <Eyebrow>Daftar periksa</Eyebrow>
        <h1 className="mt-5 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[38px]">
          Daftar rontgen dada, tanpa akun
        </h1>
        <p className="mt-5 text-[15.5px] leading-7 text-trace-muted">
          Isi data dirimu. Setelah terkirim kamu mendapat kode akses untuk mengikuti status pemeriksaan dan mengambil
          hasil awalnya.
        </p>

        <form onSubmit={submit} noValidate data-tour="request-form" className="mt-8 grid gap-5 sm:grid-cols-2">
          <FormField id="name" label="Nama lengkap" error={errors.name} className="sm:col-span-2">
            <input
              id="name"
              className={inputClass}
              autoComplete="name"
              value={draft.name}
              aria-invalid={invalid('name')}
              aria-describedby={described('name')}
              onChange={(event) => change({ name: event.target.value })}
            />
          </FormField>

          <FormField id="sex" label="Jenis kelamin" error={errors.sex}>
            <select
              id="sex"
              className={cn(inputClass, 'cursor-pointer')}
              value={draft.sex}
              aria-invalid={invalid('sex')}
              aria-describedby={described('sex')}
              onChange={(event) => change({ sex: event.target.value as PatientDraft['sex'] })}
            >
              <option value="">Pilih</option>
              <option value="female">Perempuan</option>
              <option value="male">Laki-laki</option>
            </select>
          </FormField>

          <FormField id="birthDate" label="Tanggal lahir" error={errors.birthDate}>
            <input
              id="birthDate"
              type="date"
              className={inputClass}
              value={draft.birthDate}
              max={new Date().toISOString().slice(0, 10)}
              aria-invalid={invalid('birthDate')}
              aria-describedby={described('birthDate')}
              onChange={(event) => change({ birthDate: event.target.value })}
            />
          </FormField>

          <FormField id="phone" label="Nomor telepon" error={errors.phone} optional className="sm:col-span-2">
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className={inputClass}
              value={draft.phone}
              placeholder="0812-0000-0000"
              aria-invalid={invalid('phone')}
              aria-describedby={described('phone')}
              onChange={(event) => change({ phone: event.target.value })}
            />
          </FormField>

          <FormField id="address" label="Alamat" error={errors.address} optional className="sm:col-span-2">
            <input
              id="address"
              className={inputClass}
              autoComplete="street-address"
              value={draft.address}
              placeholder="Desa, kecamatan"
              aria-invalid={invalid('address')}
              aria-describedby={described('address')}
              onChange={(event) => change({ address: event.target.value })}
            />
          </FormField>

          <FormField id="complaint" label="Keluhan" optional className="sm:col-span-2">
            <textarea
              id="complaint"
              rows={3}
              maxLength={1000}
              className={cn(inputClass, 'h-auto py-2.5 leading-6')}
              value={complaint}
              placeholder="Misalnya: batuk lebih dari dua minggu"
              onChange={(event) => setComplaint(event.target.value)}
            />
          </FormField>

          <div className="sm:col-span-2" aria-live="polite">
            {failure ? (
              <p
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-md border border-trace-flag-edge bg-trace-flag-surface px-3.5 py-3 text-[13.5px] leading-6 text-trace-flag-soft"
              >
                <ShieldAlert aria-hidden className="mt-1 size-4 shrink-0" />
                {failure}
              </p>
            ) : null}
            <TraceButton type="submit" disabled={sending} className="h-12 w-full sm:w-auto sm:px-8">
              {sending ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <>
                  <ClipboardCheck aria-hidden className="size-4" />
                  Kirim pendaftaran
                </>
              )}
            </TraceButton>
          </div>
        </form>

        <DisclaimerBanner tone="privacy" title="Datamu dipakai untuk pemeriksaan ini saja" className="mt-10">
          Data ini hanya dilihat petugas klinik untuk mencocokkan atau menyimpan rekam medismu. Kode akses adalah
          satu-satunya kunci ke statusmu, jadi jangan bagikan ke orang lain.
        </DisclaimerBanner>
      </Container>
    </div>
  );
}
