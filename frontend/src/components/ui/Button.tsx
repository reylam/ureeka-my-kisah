import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Button.
 *
 * `primary` is obsidian rather than blue: the brand's strong element is black,
 * and black-on-white gives far better contrast for the main action than the
 * calm CT blue would. CT blue appears in the focus ring and in `secondary`.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-obsidian-950 text-white hover:bg-obsidian-800 active:bg-obsidian-900 ' +
    'disabled:bg-obsidian-300 disabled:text-white',
  secondary:
    'bg-ct-100 text-ct-800 ring-1 ring-inset ring-ct-200 hover:bg-ct-200 ' +
    'active:bg-ct-300 disabled:bg-obsidian-100 disabled:text-obsidian-400 disabled:ring-obsidian-200',
  outline:
    'bg-white text-obsidian-800 ring-1 ring-inset ring-obsidian-200 hover:bg-obsidian-50 ' +
    'active:bg-obsidian-100 disabled:text-obsidian-400 disabled:bg-white',
  ghost:
    'bg-transparent text-obsidian-700 hover:bg-obsidian-100 active:bg-obsidian-200 ' +
    'disabled:text-obsidian-300 disabled:hover:bg-transparent',
  danger:
    'bg-urgent-700 text-white hover:bg-urgent-800 active:bg-urgent-800 ' +
    'disabled:bg-urgent-300 disabled:text-white',
};

/**
 * Fully rounded, matching the public site. A pill reads as a control at a
 * glance on a page otherwise built from square cards and tables, and the extra
 * horizontal padding keeps the label off the curve.
 */
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-full',
  md: 'h-9 px-4 text-sm gap-2 rounded-full',
  lg: 'h-11 px-6 text-sm gap-2 rounded-full',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Rendered before the label. Pass a 16px lucide icon. */
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'outline',
    size = 'md',
    loading = false,
    leadingIcon,
    trailingIcon,
    fullWidth = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap',
        'transition-colors duration-150 select-none',
        'disabled:cursor-not-allowed',
        sizeClasses[size],
        variantClasses[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
      ) : (
        leadingIcon
      )}
      {children}
      {!loading && trailingIcon}
    </button>
  );
});

/**
 * A link that looks like a button.
 *
 * Needed because wrapping a `<Link>` inside a `<Button>` produces an anchor
 * inside a button: invalid HTML, two focus stops, and a control that
 * announces itself twice. This renders a single anchor and shares the same
 * variant and size tables, so the two cannot drift apart.
 */
export function ButtonLink({
  to,
  variant = 'outline',
  size = 'md',
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  className,
  children,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap',
        'transition-colors duration-150 select-none',
        sizeClasses[size],
        variantClasses[variant],
        fullWidth && 'w-full',
        className,
      )}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </Link>
  );
}
