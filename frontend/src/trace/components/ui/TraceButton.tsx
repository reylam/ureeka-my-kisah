import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

/**
 * Buttons and button-shaped links.
 *
 * Three variants and nothing more. Fully rounded: a pill reads as a control
 * rather than a panel, which matters on a page where almost everything else is
 * a hairline rectangle. There are no gradients, and the disabled state is a
 * real `disabled` attribute rather than a class, so assistive technology and
 * the pointer agree about what is clickable.
 */

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'sm';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium ' +
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45';

const variants: Record<Variant, string> = {
  primary:
    'bg-trace-accent text-trace-ink hover:bg-trace-accent-soft disabled:hover:bg-trace-accent',
  secondary:
    'border border-trace-line bg-trace-card text-trace-text hover:border-trace-hover hover:bg-trace-raised',
  ghost: 'text-trace-muted hover:bg-trace-card hover:text-trace-text',
};

const sizes: Record<Size, string> = {
  md: 'h-11 px-6 text-[14px]',
  sm: 'h-9 px-4 text-[13px]',
};

export function TraceButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function TraceLinkButton({
  to,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  to: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}

/** Inline text link, used in prose and in citations. */
export function TraceAnchor({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const external = href.startsWith('http');
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      className={cn(
        'text-trace-accent underline decoration-trace-accent-edge decoration-1 underline-offset-[3px]',
        'transition-colors hover:text-trace-accent-soft hover:decoration-trace-accent-soft',
        className,
      )}
    >
      {children}
    </a>
  );
}
