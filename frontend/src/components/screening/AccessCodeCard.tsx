import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PriorityBadge } from '@/components/ui/StatusBadge';
import type { Screening } from '@/types/domain';
import { PRIORITY_HINT, formatAccessCode } from '@/lib/queue';
import { toast } from '@/stores/toastStore';
import { formatDate, formatTime } from '@/utils/date';

/**
 * A visit's access code, and its queue number once it has one.
 *
 * The code exists from the moment the request is made, so the desk can read it
 * out again at any point. It is shown large and grouped so it can be written
 * down without mistakes.
 */
export function AccessCodeCard({ screening }: { screening: Screening }) {
  const [copied, setCopied] = useState(false);
  const code = formatAccessCode(screening.accessCode);
  const queued = screening.queueNumber && screening.queuePriority;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(screening.accessCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Kode tidak bisa disalin otomatis.', code);
    }
  };

  return (
    <div className="rounded-card border border-ct-200 bg-ct-50/60 p-4">
      {queued ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-ct-200 pb-4">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">Nomor antrean</p>
            <p className="mt-1 font-mono text-4xl leading-none font-semibold text-obsidian-950">{screening.queueNumber}</p>
            {screening.queueDate && screening.submittedAt ? (
              <p className="mt-2 text-xs text-obsidian-500 tabular">
                {formatDate(screening.queueDate)} · masuk {formatTime(screening.submittedAt)}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <PriorityBadge priority={screening.queuePriority!} />
            <p className="mt-1.5 max-w-44 text-xs text-obsidian-500">{PRIORITY_HINT[screening.queuePriority!]}</p>
          </div>
        </div>
      ) : null}

      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
        <KeyRound aria-hidden className="size-3.5" />
        Kode akses pasien
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <p className="font-mono text-2xl font-semibold tracking-[0.12em] text-obsidian-950">{code}</p>
        <Button
          size="sm"
          leadingIcon={copied ? <Check className="mr-1.5 size-4 text-complete-700" /> : <Copy className="mr-1.5 size-4" />}
          onClick={() => void copy()}
        >
          {copied ? 'Tersalin' : 'Salin'}
        </Button>
      </div>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-obsidian-600">
        Dengan kode ini pasien mengikuti status permintaannya di halaman <span className="font-medium">Cek Hasil</span>,
        tanpa akun, sampai hasil awal dan nomor antreannya keluar.
      </p>
    </div>
  );
}
