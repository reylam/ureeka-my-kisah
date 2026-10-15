import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only controls must still be announced. */
  label: string;
  icon: ReactNode;
  size?: 'sm' | 'md';
  tone?: 'default' | 'onDark' | 'danger';
}

const toneClasses = {
  default: 'text-obsidian-500 hover:text-obsidian-900 hover:bg-obsidian-100',
  onDark: 'text-obsidian-300 hover:text-white hover:bg-white/10',
  danger: 'text-urgent-700 hover:bg-urgent-50',
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = 'md', tone = 'default', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'size-7' : 'size-8',
        toneClasses[tone],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
});
