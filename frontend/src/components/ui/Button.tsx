import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
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

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-sm gap-2 rounded-md',
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
