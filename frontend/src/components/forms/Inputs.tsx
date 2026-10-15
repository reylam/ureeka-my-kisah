import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { controlClasses } from './Field';

/* ── Text input ────────────────────────────────────────────────────────────── */

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  describedBy?: string;
  invalid?: boolean;
  /** Icon rendered inside the field's leading edge. */
  leadingIcon?: ReactNode;
  suffix?: ReactNode;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, describedBy, invalid, leadingIcon, suffix, ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={cn(
        controlClasses,
        'h-9',
        leadingIcon && 'pl-9',
        suffix && 'pr-12',
        className,
      )}
      {...rest}
    />
  );

  if (!leadingIcon && !suffix) return input;

  return (
    <div className="relative">
      {leadingIcon ? (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-obsidian-400 [&>svg]:size-4"
        >
          {leadingIcon}
        </span>
      ) : null}
      {input}
      {suffix ? (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-obsidian-400">
          {suffix}
        </span>
      ) : null}
    </div>
  );
});

/* ── Textarea ──────────────────────────────────────────────────────────────── */

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  describedBy?: string;
  invalid?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, describedBy, invalid, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={cn(controlClasses, 'resize-y py-2 leading-relaxed', className)}
      {...rest}
    />
  );
});

/* ── Select ────────────────────────────────────────────────────────────────── */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  describedBy?: string;
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, describedBy, invalid, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={cn(controlClasses, 'h-9 cursor-pointer appearance-none pr-9', className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-obsidian-400"
      />
    </div>
  );
});

/* ── Checkbox ──────────────────────────────────────────────────────────────── */

export function Checkbox({
  label,
  description,
  checked,
  onChange,
  disabled,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'group flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 -mx-2 transition-colors',
        disabled ? 'cursor-not-allowed opacity-55' : 'hover:bg-obsidian-50',
        className,
      )}
    >
      <span className="relative mt-px flex size-4 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer size-4 cursor-pointer appearance-none rounded border border-obsidian-300 bg-white transition-colors checked:border-obsidian-950 checked:bg-obsidian-950 disabled:cursor-not-allowed"
        />
        <Check
          aria-hidden
          className="pointer-events-none absolute size-3 text-white opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] leading-5 text-obsidian-800">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-obsidian-500">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

/* ── Radio group ───────────────────────────────────────────────────────────── */

export interface RadioOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export function RadioGroup<T extends string>({
  name,
  value,
  options,
  onChange,
  className,
}: {
  name: string;
  value: T | null;
  options: RadioOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn('space-y-1.5', className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors',
              option.disabled && 'cursor-not-allowed opacity-55',
              selected
                ? 'border-ct-500 bg-ct-50 ring-1 ring-ct-500/40'
                : 'border-obsidian-200 bg-white hover:border-obsidian-300 hover:bg-obsidian-50',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              className="mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-obsidian-300 bg-white transition-shadow checked:border-[5px] checked:border-obsidian-950 disabled:cursor-not-allowed"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-obsidian-900">{option.label}</span>
              {option.description ? (
                <span className="mt-0.5 block text-xs leading-relaxed text-obsidian-500">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ── Search ────────────────────────────────────────────────────────────────── */

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name, required because the visual label is just an icon. */
  label: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-obsidian-400"
      />
      <input
        type="search"
        role="searchbox"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(controlClasses, 'h-9 pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden')}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-obsidian-400 transition-colors hover:bg-obsidian-100 hover:text-obsidian-700"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/* ── Toggle switch ─────────────────────────────────────────────────────────── */

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  tone = 'default',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** `attention` marks controls that put the app into a special demo mode. */
  tone?: 'default' | 'attention';
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-obsidian-900">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-obsidian-500">
            {description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked
            ? tone === 'attention'
              ? 'bg-attention-500'
              : 'bg-obsidian-950'
            : 'bg-obsidian-300',
        )}
      >
        <span className="sr-only">{typeof label === 'string' ? label : 'Toggle'}</span>
        <span
          aria-hidden
          className={cn(
            'pointer-events-none inline-block size-4 translate-y-0 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}
