import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Section furniture: a compact uppercase eyebrow, a headline, and an optional
 * standfirst. Hierarchy comes from weight and spacing rather than size, so a
 * page can carry a dozen sections without shouting.
 */

export function Eyebrow({
  children,
  className,
  index,
}: {
  children: ReactNode;
  className?: string;
  /** Chapter marker, e.g. "03". Renders in the accent colour. */
  index?: string;
}) {
  return (
    <p className={cn('trace-label flex items-center gap-2.5 text-trace-dim', className)}>
      {index ? (
        <>
          <span className="text-trace-accent">{index}</span>
          <span aria-hidden className="h-px w-5 bg-trace-line" />
        </>
      ) : null}
      {children}
    </p>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  index,
  title,
  standfirst,
  align = 'left',
  level = 2,
  className,
  children,
}: {
  id?: string;
  eyebrow?: string;
  index?: string;
  title: ReactNode;
  standfirst?: ReactNode;
  align?: 'left' | 'center';
  level?: 2 | 3;
  className?: string;
  /** Trailing slot, e.g. a link or a small label. */
  children?: ReactNode;
}) {
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <header className={cn(align === 'center' && 'mx-auto max-w-2xl text-center', className)}>
      {eyebrow ? <Eyebrow index={index}>{eyebrow}</Eyebrow> : null}
      <Tag
        id={id}
        className={cn(
          'mt-4 font-semibold tracking-[-0.02em]',
          level === 2 ? 'text-[26px] leading-[1.2] sm:text-[32px]' : 'text-[20px] sm:text-[22px]',
        )}
      >
        {title}
      </Tag>
      {standfirst ? (
        <p
          className={cn(
            'mt-4 text-[15px] leading-7 text-trace-muted',
            align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-2xl',
          )}
        >
          {standfirst}
        </p>
      ) : null}
      {children}
    </header>
  );
}
