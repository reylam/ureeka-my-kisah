import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Surface primitive. Thin border, almost no shadow. Elevation is carried by
 * the border and background, not by drop shadows.
 */
export function Card({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article' | 'aside';
}) {
  return (
    <Tag
      className={cn(
        'rounded-card border border-obsidian-200 bg-white shadow-card',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-obsidian-200 px-4 py-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          <span aria-hidden className="mt-0.5 text-ct-700 [&>svg]:size-4">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold tracking-wide text-obsidian-900 uppercase">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-obsidian-500">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={cn(padded && 'px-4 py-3.5', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 border-t border-obsidian-200 bg-obsidian-50/60 px-4 py-2.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Definition list row, used heavily on detail pages. Keeping labels narrow and
 * right-aligned to the value column gives the record a scannable, clinical feel.
 */
export function DetailRow({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-[minmax(7rem,9rem)_1fr] gap-3 py-1.5', className)}>
      <dt className="text-[13px] text-obsidian-500">{label}</dt>
      <dd className="min-w-0 text-[13px] text-obsidian-900">{children}</dd>
    </div>
  );
}
