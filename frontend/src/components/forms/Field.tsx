import { useId, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Form field wrapper.
 *
 * Handles the accessibility plumbing once: label association, hint and error
 * wiring via `aria-describedby`, and `aria-invalid`. Children receive the ids
 * they need through a render prop so native inputs stay native.
 */
export interface FieldRenderProps {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

export function Field({
  label,
  hint,
  error,
  required = false,
  optional = false,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  /** Shows a quiet "optional" marker, clearer than leaving it ambiguous. */
  optional?: boolean;
  className?: string;
  children: (props: FieldRenderProps) => ReactNode;
}) {
  const baseId = useId();
  const id = `${baseId}-field`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-[13px] font-medium text-obsidian-800">
        {label}
        {required ? (
          <span className="text-urgent-700" aria-hidden>
            *
          </span>
        ) : null}
        {optional ? <span className="text-xs font-normal text-obsidian-400">optional</span> : null}
      </label>

      <div className="mt-1.5">{children({ id, describedBy, invalid: Boolean(error) })}</div>

      {hint && !error ? (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-obsidian-500">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-urgent-700"
        >
          <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Shared input surface styling, so every control matches. */
export const controlClasses =
  'block w-full rounded-md border border-obsidian-200 bg-white px-3 text-sm text-obsidian-900 ' +
  'placeholder:text-obsidian-400 transition-colors ' +
  'hover:border-obsidian-300 ' +
  'focus:border-ct-500 focus:outline-none focus-visible:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-obsidian-50 disabled:text-obsidian-400 ' +
  'aria-[invalid=true]:border-urgent-500 aria-[invalid=true]:bg-urgent-50/40';

/** A labelled group of related controls (checkbox sets, radio sets). */
export function Fieldset({
  legend,
  hint,
  children,
  className,
}: {
  legend: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="text-[13px] font-medium text-obsidian-800">{legend}</legend>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-obsidian-500">{hint}</p> : null}
      <div className="mt-2.5">{children}</div>
    </fieldset>
  );
}
