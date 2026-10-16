import type { ReactNode } from 'react';
import { AlertTriangle, FlaskConical, Info, ShieldAlert } from 'lucide-react';
import { cn } from '@/utils/cn';

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
