import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, Check, KeyRound, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { Container } from '@/trace/components/ui/Container';
import { Eyebrow } from '@/trace/components/ui/SectionHeading';
import { TraceButton } from '@/trace/components/ui/TraceButton';
import { DisclaimerBanner } from '@/trace/components/ui/DisclaimerBanner';
import type { PublicStatus, QueuePriority, ScreeningOutcome, ScreeningStatus } from '@/types/domain';
import { ApiError } from '@/lib/apiClient';
import { lookupStatus } from '@/services/recordsApi';
import { PRIORITY_LABEL, formatAccessCode, formatTypedCode } from '@/lib/queue';
import { cn } from '@/utils/cn';
import { formatDate, formatTime } from '@/utils/date';

/**
 * Where a patient follows their request, with the access code alone.
 *
 * Until the radiologist has submitted the screening there is no result, only a
 * status, so the page asks again every few seconds and says so. Once the
 * result is out it shows the queue number, the priority and the model's first
 * reading in plain words, and keeps refreshing the place in the queue until
 * the patient has been called.
 *
 * The wording needs the most care here: this is the one place a person reads
 * about their own X-ray without a clinician in the room. Every outcome says
 * what it does not mean, and "nothing stood out" is as hedged as the rest.
 */

const POLL_MS = 15_000;

/* The code is kept for this tab only, so returning from another page does not
   mean typing it again. Not in localStorage: a clinic may share a device. */
const STORAGE_KEY = 'parupintas.access-code';

export function rememberCode(code: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Private mode or blocked storage: the person types it again.
  }
}

function recallCode(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function forgetCode(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

const OUTCOME_COPY: Record<ScreeningOutcome | 'none', { title: string; body: string }> = {
  'flagged-for-review': {
    title: 'Rontgenmu perlu dilihat lebih dekat',
    body: 'Pembacaan otomatis menilai gambarmu mirip dengan pola yang perlu diperiksa dokter. Ini belum berarti kamu sakit TB. Dokter yang akan menilai langsung dan menjelaskan langkah berikutnya.',
  },
  'no-alert': {
    title: 'Tidak ada yang menonjol pada pembacaan awal',
    body: 'Pembacaan otomatis tidak menemukan pola yang menonjol. Ini belum berarti kamu bebas dari TB, karena rontgen bisa melewatkan sebagian kasus. Dokter tetap akan menilai.',
  },
  inconclusive: {
    title: 'Pembacaan awal belum meyakinkan',
    body: 'Pembacaan otomatis belum bisa memberi jawaban yang bisa dipegang. Dokter akan menilai rontgenmu langsung.',
  },
  none: {
    title: 'Dokter membaca rontgenmu langsung',
    body: 'Rontgenmu tidak dibaca oleh alat bantu otomatis. Dokter radiologi sudah memeriksanya dan menentukan prioritasmu.',
  },
};

const PRIORITY_COPY: Record<QueuePriority, string> = {
  high: 'Kamu dipanggil lebih dulu daripada pasien dengan prioritas lain.',
  medium: 'Kamu dipanggil setelah pasien dengan prioritas tinggi.',
  low: 'Kamu dipanggil setelah pasien dengan prioritas tinggi dan sedang.',
};

const PRIORITY_TONE: Record<QueuePriority, string> = {
  high: 'border-trace-flag-edge bg-trace-flag-surface text-trace-flag-soft',
  medium: 'border-trace-accent-edge bg-trace-accent-surface text-trace-accent-soft',
  low: 'border-trace-line bg-trace-raised text-trace-muted',
};

const STEPS: { status: ScreeningStatus; label: string }[] = [
  { status: 'waiting', label: 'Terdaftar' },
  { status: 'examining', label: 'Diperiksa dokter' },
  { status: 'queued', label: 'Hasil keluar' },
  { status: 'served', label: 'Dipanggil' },
];
const STEP_INDEX: Record<ScreeningStatus, number> = { waiting: 0, examining: 1, queued: 2, served: 3 };

function describeFailure(cause: unknown): string {
  if (cause instanceof ApiError && cause.status === 404) {
    return 'Kode akses tidak ditemukan. Periksa kembali kode yang kamu terima.';
  }
  if (cause instanceof ApiError && cause.status === 429) return cause.message;
  if (cause instanceof ApiError && cause.status === 0) return 'Server tidak bisa dihubungi. Periksa koneksi lalu coba lagi.';
  return 'Status belum bisa dibuka sekarang. Coba lagi sebentar lagi.';
}

export function PatientResultPage() {
  const location = useLocation();
  const handed = (location.state as { code?: string } | null)?.code ?? '';

  const [typed, setTyped] = useState(() => formatTypedCode(handed || recallCode()));
  /** The code whose status is on screen; polling follows this one. */
  const [active, setActive] = useState<string | null>(null);
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const ticket = useRef(0);

  useEffect(() => {
    document.title = 'Cek Hasil · PARUPINTAS';
  }, []);

  const load = useCallback(async (code: string, { quiet = false } = {}) => {
    const mine = (ticket.current += 1);
    if (!quiet) setLoading(true);
    try {
      const next = await lookupStatus(code);
      if (mine !== ticket.current) return;
      setStatus(next);
      setActive(code);
      setMessage(null);
      setCheckedAt(new Date());
      rememberCode(code);
    } catch (cause) {
      if (mine !== ticket.current) return;
      // A failed background refresh keeps the last status on screen.
      if (!quiet) {
        setStatus(null);
        setActive(null);
        forgetCode();
      }
      setMessage(describeFailure(cause));
    } finally {
      if (mine === ticket.current) setLoading(false);
    }
  }, []);

  // Arriving from the request form, or with a remembered code: open it straight away.
  useEffect(() => {
    const clean = typed.replace('-', '');
    if (clean.length === 8) void load(clean);
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ask again every few seconds until the patient has been called, and only
  // while the page is visible.
  useEffect(() => {
    if (!active || !status || status.status === 'served') return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(active, { quiet: true });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, status, load]);

  const complete = typed.replace('-', '').length === 8;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (complete && !loading) void load(typed.replace('-', ''));
  };

  return (
    <div className="border-b border-trace-line">
      <Container width="narrow" className="py-14 sm:py-16">
        <Eyebrow>Cek hasil</Eyebrow>
        <h1 className="mt-5 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[38px]">
          Status pemeriksaan dan nomor antreanmu
        </h1>
        <p className="mt-5 text-[15.5px] leading-7 text-trace-muted">
          Tidak perlu akun. Masukkan kode akses yang kamu terima saat mendaftar.
        </p>

        <form onSubmit={submit} data-tour="status-form" className="mt-8 flex flex-col gap-3 sm:flex-row" noValidate>
          <label className="sr-only" htmlFor="access-code">
            Kode akses
          </label>
          <div className="relative flex-1">
            <KeyRound aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-trace-dim" />
            <input
              id="access-code"
              value={typed}
              onChange={(event) => setTyped(formatTypedCode(event.target.value))}
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={9}
              placeholder="XXXX-XXXX"
              className="h-12 w-full rounded-full border border-trace-line bg-trace-card pr-4 pl-11 font-mono text-[17px] tracking-[0.14em] text-trace-text placeholder:text-trace-dim focus:border-trace-accent focus:outline-none"
            />
          </div>
          <TraceButton type="submit" disabled={!complete || loading} className="h-12 sm:px-7">
            {loading ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <>
                Buka status
                <ArrowRight aria-hidden className="size-4" />
              </>
            )}
          </TraceButton>
        </form>

        <div aria-live="polite">
          {message ? (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-md border border-trace-flag-edge bg-trace-flag-surface px-3.5 py-3 text-[13.5px] leading-6 text-trace-flag-soft"
            >
              <ShieldAlert aria-hidden className="mt-1 size-4 shrink-0" />
              {message}
            </p>
          ) : null}
        </div>

        {status && active ? (
          <StatusPanel
            status={status}
            code={active}
            checkedAt={checkedAt}
            refreshing={loading}
            onRefresh={() => void load(active, { quiet: true })}
          />
        ) : null}

        <DisclaimerBanner tone="caution" title="Ini bukan diagnosis" className="mt-8">
          Hasil awal berasal dari alat bantu screening berbasis AI dan pemeriksaan dokter radiologi. Dokter yang
          menentukan apa yang sebenarnya terjadi, lewat pemeriksaan langsung dan, bila perlu, tes dahak. Tetap tunggu
          panggilan sesuai nomor antreanmu, dan segera bilang ke petugas kalau keluhanmu bertambah berat.
        </DisclaimerBanner>
      </Container>
    </div>
  );
}

function StatusPanel({
  status,
  code,
  checkedAt,
  refreshing,
  onRefresh,
}: {
  status: PublicStatus;
  code: string;
  checkedAt: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const step = STEP_INDEX[status.status];
  const released = status.status === 'queued' || status.status === 'served';
  const outcome = OUTCOME_COPY[status.outcome ?? 'none'];

  return (
    <section aria-label="Status pemeriksaan" className="mt-8 overflow-hidden rounded-md border border-trace-line bg-trace-card">
      {/* Who and when, and how fresh this is. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-trace-line px-5 py-3.5 sm:px-7">
        <p className="text-[13.5px] text-trace-muted">
          <span className="font-medium text-trace-text">{status.name}</span> · {formatAccessCode(code)} · daftar{' '}
          {formatDate(status.requestDate)}, {formatTime(status.requestedAt)}
        </p>
        {status.status !== 'served' ? (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-trace-dim transition-colors hover:text-trace-text"
          >
            <RefreshCw aria-hidden className={cn('size-3.5', refreshing && 'animate-spin')} />
            {checkedAt ? `Diperbarui ${formatTime(checkedAt.toISOString())}` : 'Perbarui'}
          </button>
        ) : null}
      </div>

      {/* Where the visit is. */}
      <ol className="grid grid-cols-4 border-b border-trace-line">
        {STEPS.map((item, index) => {
          const done = index < step || (index === step && status.status === 'served');
          const current = index === step && status.status !== 'served';
          return (
            <li
              key={item.status}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex flex-col items-center gap-1.5 px-1 py-3.5 text-center text-[11.5px] leading-4 sm:text-[12.5px]',
                current ? 'text-trace-text' : done ? 'text-trace-muted' : 'text-trace-dim',
              )}
            >
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full border font-mono text-[11px]',
                  done && 'border-trace-accent bg-trace-accent text-trace-ink',
                  current && 'border-trace-accent text-trace-accent',
                  !done && !current && 'border-trace-line',
                )}
              >
                {done ? <Check aria-hidden className="size-3.5" /> : index + 1}
              </span>
              {item.label}
            </li>
          );
        })}
      </ol>

      {released ? (
        <>
          <div className="border-b border-trace-line px-5 py-6 sm:px-7">
            <p className="trace-label text-trace-dim">Nomor antreanmu</p>
            <p className="mt-2 font-mono text-[56px] leading-none font-semibold tracking-tight text-trace-text">
              {status.queueNumber}
            </p>
            {status.status === 'served' ? (
              <p className="mt-4 text-[14px] leading-6 text-trace-muted">
                Kamu sudah dipanggil{status.servedAt ? ` pukul ${formatTime(status.servedAt)}` : ''}. Kalau belum bertemu
                dokter, tanyakan ke petugas di meja pendaftaran.
              </p>
            ) : (
              <>
                <p className={cn('mt-5 inline-flex rounded-full border px-3 py-1 text-[12.5px] font-medium', PRIORITY_TONE[status.priority!])}>
                  Prioritas {PRIORITY_LABEL[status.priority!].toLowerCase()}
                </p>
                <p className="mt-2.5 text-[13.5px] leading-6 text-trace-muted">{PRIORITY_COPY[status.priority!]}</p>
                <p className="mt-3 text-[14px] text-trace-text">
                  {status.ahead === 0 ? 'Kamu berikutnya yang dipanggil.' : `${status.ahead} orang lagi sebelum giliranmu.`}
                </p>
              </>
            )}
          </div>
          <div className="px-5 py-6 sm:px-7">
            <p className="trace-label text-trace-dim">Hasil awal screening</p>
            <h2 className="mt-2.5 text-[19px] leading-snug font-semibold tracking-[-0.01em] text-trace-text">{outcome.title}</h2>
            <p className="mt-3 text-[14px] leading-7 text-trace-muted">{outcome.body}</p>
          </div>
        </>
      ) : (
        <div className="px-5 py-7 sm:px-7">
          <p className="flex items-center gap-2 trace-label text-trace-dim">
            <Loader2 aria-hidden className="size-3.5 animate-spin" />
            Hasil belum keluar
          </p>
          <h2 className="mt-3 text-[19px] leading-snug font-semibold tracking-[-0.01em] text-trace-text">
            {status.status === 'waiting' ? 'Menunggu pemeriksaan rontgen' : 'Rontgenmu sedang diperiksa dokter'}
          </h2>
          <p className="mt-3 text-[14px] leading-7 text-trace-muted">
            {status.status === 'waiting'
              ? status.ahead
                ? `Ada ${status.ahead} orang yang mendaftar sebelum kamu hari ini. `
                : 'Kamu berikutnya untuk diperiksa. '
              : 'Dokter radiologi sedang membaca rontgenmu dan menentukan prioritas antrean. '}
            Halaman ini memeriksa ulang sendiri setiap {POLL_MS / 1000} detik, jadi biarkan terbuka. Nomor antrean
            muncul di sini begitu hasilnya keluar.
          </p>
        </div>
      )}
    </section>
  );
}
