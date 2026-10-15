import { useId, useRef, useState } from 'react';
import { AlertTriangle, ImageUp, Loader2, UploadCloud } from 'lucide-react';
import { ACCEPTED_TYPES, MAX_BYTES, MIN_EDGE_PX, type UploadError } from '@/trace/hooks/useImageUpload';
import { cn } from '@/utils/cn';

/**
 * File selection: drop, click, or keyboard.
 *
 * The clickable surface is a `<label>` wrapping a real, visually hidden
 * `<input type="file">`. That is what makes the zone reachable by Tab and
 * operable by Enter and Space without reimplementing any of it, and it is why
 * there is no `tabIndex` or `onKeyDown` here.
 *
 * Dragging is layered on top: the drop handler is on the surrounding element,
 * with a counter so that dragging across a child element does not flicker the
 * highlight off and on.
 */
export function UploadDropzone({
  onSelect,
  error,
  isReading,
  hasImage,
}: {
  onSelect: (file: File | null | undefined) => void;
  error: UploadError | null;
  isReading: boolean;
  hasImage: boolean;
}) {
  const inputId = useId();
  const errorId = useId();
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  return (
    <div>
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          onSelect(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          'rounded-md border border-dashed transition-colors',
          dragging
            ? 'border-trace-accent bg-trace-accent-surface'
            : 'border-trace-line bg-trace-card/50 hover:border-trace-hover',
          error && 'border-trace-flag-edge',
        )}
      >
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center px-5 py-10 text-center sm:py-14"
        >
          <span
            className={cn(
              'grid size-12 place-items-center rounded-full border',
              dragging
                ? 'border-trace-accent text-trace-accent'
                : 'border-trace-line text-trace-dim',
            )}
          >
            {isReading ? (
              <Loader2 aria-hidden className="size-5 animate-spin" />
            ) : dragging ? (
              <ImageUp aria-hidden className="size-5" />
            ) : (
              <UploadCloud aria-hidden className="size-5" />
            )}
          </span>

          <span className="mt-4 text-[15px] font-medium text-trace-text">
            {hasImage ? 'Replace the chest X-ray' : 'Drop a chest X-ray here'}
          </span>
          <span className="mt-1.5 text-[13.5px] text-trace-muted">
            or <span className="text-trace-accent underline underline-offset-2">browse your files</span>
          </span>

          <span className="mt-5 font-mono text-[11px] tracking-[0.04em] text-trace-dim">
            JPG · JPEG · PNG · max {MAX_BYTES / 1_000_000} MB · shorter edge ≥ {MIN_EDGE_PX} px
          </span>

          <input
            id={inputId}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            className="sr-only"
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              onSelect(event.target.files?.[0]);
              // Reset so selecting the same file twice fires change again.
              event.target.value = '';
            }}
          />
        </label>
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-md border border-trace-flag-edge bg-trace-flag-surface px-3.5 py-3 text-[13px] leading-5 text-trace-flag-soft"
        >
          <AlertTriangle aria-hidden className="mt-px size-4 shrink-0 text-trace-flag" />
          <span>{error.message}</span>
        </p>
      ) : null}
    </div>
  );
}
