import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * A pulled-aside remark in the flow of the research narrative: a definition, a
 * caveat, or the sentence a reader should leave with. A left rule and a mono
 * label, no box, so it reads as part of the document rather than a widget.
 */
export function ResearchCallout({
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
        'border-l-2 pl-4 sm:pl-5',
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
      <div className="mt-2 text-[14.5px] leading-7 text-trace-muted [&_strong]:font-medium [&_strong]:text-trace-text">
        {children}
      </div>
    </aside>
  );
}
