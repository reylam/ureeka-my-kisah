import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * A pulled-aside remark: the sentence a reader should leave the section with.
 * A left rule and a small label, no box, so it reads as part of the page
 * rather than as a widget.
 */
export function Callout({
  label,
  children,
  tone = 'accent',
  className,
}: {
  label: string;
  children: ReactNode;
  tone?: 'accent' | 'caution' | 'quiet';
  className?: string;
}) {
  return (
    <aside
      className={cn(
        'border-l-2 pl-5 sm:pl-6',
        tone === 'accent' && 'border-trace-accent',
        tone === 'caution' && 'border-trace-flag',
        tone === 'quiet' && 'border-trace-line',
        className,
      )}
    >
      <p
        className={cn(
          'trace-label',
          tone === 'accent' && 'text-trace-accent',
          tone === 'caution' && 'text-trace-flag',
          tone === 'quiet' && 'text-trace-dim',
        )}
      >
        {label}
      </p>
      <div className="mt-2.5 text-[15px] leading-7 text-trace-muted [&_strong]:font-medium [&_strong]:text-trace-text">
        {children}
      </div>
    </aside>
  );
}
