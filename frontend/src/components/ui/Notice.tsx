import type { ReactNode } from 'react';
import { AlertTriangle, FlaskConical, Info, ShieldAlert } from 'lucide-react';
import { cn } from '@/utils/cn';
import { MODEL_RESULT_NOTICE, SIMULATED_RESULT_NOTICE } from '@/data/model';
import { useModelConnected } from '@/stores/modelStore';
import { SCREENING_DISCLAIMER } from '@/types/inference';

/**
 * Inline notice / callout.
 */
export type NoticeTone = 'info' | 'attention' | 'urgent' | 'demo';

const toneConfig: Record<NoticeTone, { classes: string; icon: ReactNode; iconClasses: string }> = {
  info: {
    classes: 'border-ct-200 bg-ct-50/80',
    icon: <Info />,
    iconClasses: 'text-ct-700',
  },
  attention: {
    classes: 'border-attention-300/70 bg-attention-50',
    icon: <AlertTriangle />,
    iconClasses: 'text-attention-700',
  },
  urgent: {
    classes: 'border-urgent-300/70 bg-urgent-50',
    icon: <ShieldAlert />,
    iconClasses: 'text-urgent-700',
  },
  demo: {
    classes: 'border-obsidian-200 bg-obsidian-50',
    icon: <FlaskConical />,
    iconClasses: 'text-obsidian-500',
  },
};

export function Notice({
  tone = 'info',
  title,
  children,
  className,
  compact = false,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const config = toneConfig[tone];
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-md border',
        compact ? 'px-3 py-2' : 'px-3.5 py-3',
        config.classes,
        className,
      )}
    >
      <span aria-hidden className={cn('mt-px shrink-0 [&>svg]:size-4', config.iconClasses)}>
        {config.icon}
      </span>
      <div className="min-w-0 text-[13px] leading-relaxed text-obsidian-700">
        {title ? <p className="font-medium text-obsidian-900">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-1')}>{children}</div> : null}
      </div>
    </div>
  );
}

/**
 * The standing notice attached to anything showing model output.
 *
 * Used in three densities so it can sit in a table cell, above a result panel,
 * or at the top of a printed report without looking out of place. The
 * wording never softens.
 */
export function SimulatedResultNotice({
  variant = 'full',
  className,
}: {
  variant?: 'full' | 'compact' | 'inline';
  className?: string;
}) {
  const connected = useModelConnected();

  if (variant === 'inline') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium text-obsidian-500',
          className,
        )}
      >
        <FlaskConical aria-hidden className="size-3.5" />
        {connected ? MODEL_RESULT_NOTICE : SIMULATED_RESULT_NOTICE}
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <Notice tone="demo" compact className={className}>
        <span className="font-medium text-obsidian-900">
          {connected ? MODEL_RESULT_NOTICE : SIMULATED_RESULT_NOTICE}
        </span>{' '}
        {connected
          ? 'Output model membantu pembacaan klinisi dan tidak pernah menggantikannya.'
          : 'Data diteruskan ke klinisi tanpa output model.'}
      </Notice>
    );
  }

  return (
    <Notice
      tone="demo"
      title={connected ? MODEL_RESULT_NOTICE : SIMULATED_RESULT_NOTICE}
      className={className}
    >
      <p>
        {connected
          ? 'Semua output model di halaman ini berasal dari classifier terlatih. Model ini belum divalidasi secara klinis di sini, tidak ada klaim angka performa, dan hanya membantu pembacaan klinisi tanpa menggantikannya.'
          : 'Belum ada model yang menganalisis radiograf ini. Klinisi meninjau gambar secara langsung dan mencatat keputusannya.'}
      </p>
      <p className="mt-2 border-l-2 border-obsidian-300 pl-2.5 text-xs text-obsidian-600">
        {SCREENING_DISCLAIMER}
      </p>
    </Notice>
  );
}

/** Short banner stating the whole environment is a prototype. */
export function PrototypeNotice({ className }: { className?: string }) {
  return (
    <Notice tone="demo" compact className={className}>
      Prototipe demonstrasi. Semua pasien, fasilitas, dan hasil di aplikasi ini adalah data sintetis.
    </Notice>
  );
}
