import { AlertTriangle, Check, Circle, Loader2 } from 'lucide-react';
import {
  STAGES,
  type InferenceStage,
  type InferenceState,
} from '@/trace/hooks/useSimulatedInference';
import { cn } from '@/utils/cn';

/**
 * The run state, named.
 *
 * Six states are reachable and all six are labelled here: waiting for a file,
 * file selected, running, complete, failed, and reset. The middle stages are
 * phrased in the conditional ("would resize") because that work is not
 * happening, and a progress bar implying otherwise would be the single most
 * misleading element on the page.
 *
 * `aria-live="polite"` on the status line means a screen reader hears the
 * transitions instead of watching a bar it cannot see.
 */
export function InferenceStatus({
  state,
  hasImage,
  stageIndex,
  progress,
  errorMessage,
  stages = STAGES,
  live = false,
  className,
}: {
  state: InferenceState;
  hasImage: boolean;
  stageIndex: number;
  progress: number;
  errorMessage: string | null;
  /** The stages of the active mode. Defaults to the simulated ones. */
  stages?: InferenceStage[];
  /** True when a real model answers, which changes what the states say. */
  live?: boolean;
  className?: string;
}) {
  const display = live ? resolveLiveDisplay(state, hasImage) : resolveDisplay(state, hasImage);

  return (
    <div className={cn('rounded-md border border-trace-line bg-trace-card', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-trace-line px-4 py-3">
        <p className="trace-label text-trace-dim">Status proses</p>
        <p
          aria-live="polite"
          className={cn(
            'inline-flex items-center gap-2 rounded border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em]',
            display.tone,
          )}
        >
          {display.spinning ? <Loader2 aria-hidden className="size-3 animate-spin" /> : null}
          {display.label}
        </p>
      </div>

      <div className="px-4 py-4">
        <p className="text-[13.5px] leading-6 text-trace-muted">{display.description}</p>

        {state === 'running' || state === 'done' ? (
          <>
            <div
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={live ? 'Progres analisis' : 'Progres proses simulasi'}
              className="mt-4 h-1 w-full overflow-hidden rounded-full bg-trace-raised"
            >
              <div
                className="h-full rounded-full bg-trace-accent transition-[width] duration-300"
                style={{ width: `${Math.max(progress * 100, 4)}%` }}
              />
            </div>

            <ol className="mt-4 space-y-2.5">
              {stages.map((stage, index) => {
                const done = index < stageIndex || state === 'done';
                const active = index === stageIndex && state === 'running';
                return (
                  <li key={stage.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0">
                      {done ? (
                        <Check aria-hidden className="size-3.5 text-trace-accent" />
                      ) : active ? (
                        <Loader2 aria-hidden className="size-3.5 animate-spin text-trace-accent" />
                      ) : (
                        <Circle aria-hidden className="size-3.5 text-trace-line" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          'block text-[13px]',
                          done || active ? 'text-trace-text' : 'text-trace-dim',
                        )}
                      >
                        {stage.label}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-5 text-trace-dim">
                        {stage.detail}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        ) : null}

        {state === 'error' && errorMessage ? (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-md border border-trace-flag-edge bg-trace-flag-surface px-3.5 py-3 text-[13px] leading-5 text-trace-flag-soft"
          >
            <AlertTriangle aria-hidden className="mt-px size-4 shrink-0 text-trace-flag" />
            <span>{errorMessage}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** What each state says when a real model is doing the work. */
function resolveLiveDisplay(state: InferenceState, hasImage: boolean) {
  const neutral = 'border-trace-line bg-trace-raised text-trace-dim';
  const accent = 'border-trace-accent-edge bg-trace-accent-surface text-trace-accent-soft';
  const flag = 'border-trace-flag-edge bg-trace-flag-surface text-trace-flag-soft';

  if (state === 'error') {
    return {
      label: 'Gagal',
      tone: flag,
      spinning: false,
      description:
        'Analisis berhenti sebelum selesai. Gambar yang kamu pilih masih termuat, jadi kamu bisa mencobanya lagi.',
    };
  }
  if (state === 'running') {
    return {
      label: 'Memproses',
      tone: accent,
      spinning: true,
      description: 'Gambar sedang dibaca oleh model screening. Biasanya hanya butuh beberapa detik.',
    };
  }
  if (state === 'done') {
    return {
      label: 'Selesai',
      tone: accent,
      spinning: false,
      description:
        'Hasil dari model ada di bawah, lengkap dengan risk point dan batasannya. Ini alat bantu screening, bukan diagnosis.',
    };
  }
  if (hasImage) {
    return {
      label: 'Gambar siap',
      tone: accent,
      spinning: false,
      description:
        'Gambar sudah termuat. Belum ada yang dikirim; gambar baru dikirim ke server setelah kamu menekan tombol.',
    };
  }
  return {
    label: 'Siap',
    tone: neutral,
    spinning: false,
    description: 'Menunggu foto rontgen dada. Letakkan file JPG atau PNG, atau cari dari perangkat.',
  };
}

function resolveDisplay(state: InferenceState, hasImage: boolean) {
  const neutral = 'border-trace-line bg-trace-raised text-trace-dim';
  const accent = 'border-trace-accent-edge bg-trace-accent-surface text-trace-accent-soft';
  const flag = 'border-trace-flag-edge bg-trace-flag-surface text-trace-flag-soft';

  if (state === 'error') {
    return {
      label: 'Gagal',
      tone: flag,
      spinning: false,
      description: 'Proses berhenti. Gambar yang dipilih masih termuat, jadi kamu bisa mencoba lagi.',
    };
  }
  if (state === 'running') {
    return {
      label: 'Memproses',
      tone: accent,
      spinning: true,
      description:
        'Menjalankan langkah-langkah yang akan ditempuh tools screening sungguhan. Tidak ada yang memeriksa gambarnya.',
    };
  }
  if (state === 'done') {
    return {
      label: 'Selesai',
      tone: accent,
      spinning: false,
      description:
        'Contoh hasil ada di bawah. Hasil ini dipilih dari nama dan ukuran file, bukan dihitung dari gambarnya.',
    };
  }
  if (hasImage) {
    return {
      label: 'Gambar dimuat',
      tone: accent,
      spinning: false,
      description: 'Gambarmu sudah dimuat dan tombolnya siap dipakai. Belum ada yang dikirim ke mana pun.',
    };
  }
  return {
    label: 'Siap',
    tone: neutral,
    spinning: false,
    description: 'Menunggu chest X-ray. Drop file JPG atau PNG, atau cari di perangkatmu.',
  };
}
