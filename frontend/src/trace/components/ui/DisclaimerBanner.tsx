import type { ReactNode } from 'react';
import { Info, ShieldAlert, Lock } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Standing disclosures.
 *
 * Kept deliberately quiet. A screaming red banner on every page gets tuned out
 * within a minute, which defeats the purpose; a hairline panel that stays put
 * and reads like part of the document does not.
 */

type Tone = 'caution' | 'info' | 'privacy';

const TONES: Record<Tone, { icon: typeof Info; frame: string; icons: string }> = {
  caution: {
    icon: ShieldAlert,
    frame: 'border-[#4a3b1c] bg-trace-flag-surface',
    icons: 'text-trace-flag',
  },
  info: {
    icon: Info,
    frame: 'border-[#2b445f] bg-trace-accent-surface',
    icons: 'text-trace-accent',
  },
  privacy: {
    icon: Lock,
    frame: 'border-trace-line bg-trace-card',
    icons: 'text-trace-muted',
  },
};

export function DisclaimerBanner({
  tone = 'caution',
  title,
  children,
  className,
  compact = false,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const config = TONES[tone];
  const Icon = config.icon;
  return (
    <aside
      className={cn(
        'flex gap-3 rounded-md border',
        compact ? 'px-3.5 py-3' : 'p-4 sm:p-5',
        config.frame,
        className,
      )}
    >
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', config.icons)} strokeWidth={2} />
      <div className="min-w-0">
        <p className={cn('font-medium text-trace-text', compact ? 'text-[13px]' : 'text-sm')}>
          {title}
        </p>
        {children ? (
          <div
            className={cn(
              'mt-1.5 text-trace-muted',
              compact ? 'text-[12.5px] leading-5' : 'text-[13.5px] leading-6',
            )}
          >
            {children}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

/** The one-line form used in the hero and under the demo result. */
export function InlineDisclaimer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'inline-flex items-start gap-2 text-[12.5px] leading-5 text-trace-dim',
        className,
      )}
    >
      <ShieldAlert aria-hidden className="mt-px size-3.5 shrink-0 text-trace-flag" strokeWidth={2} />
      <span>{children}</span>
    </p>
  );
}
