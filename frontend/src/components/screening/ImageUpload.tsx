import { useCallback, useEffect, useRef, useState } from 'react';
import { FileImage, Replace, Trash2, Upload, X } from 'lucide-react';
import type { ImageMeta } from '@/types/domain';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Notice } from '@/components/ui/Notice';
import { formatBytes } from '@/utils/format';

/**
 * Chest radiograph upload.
 *
 * This component only prepares the file: it is read into an object URL for
 * preview and handed to the caller as a Blob. Nothing is sent from here. The
 * progress bar is labelled as local processing for that reason; the actual
 * upload happens when the screening is submitted.
 */

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'] as const;
const ACCEPTED_LABEL = 'PNG, JPEG or WebP';
const MAX_BYTES = 12 * 1024 * 1024;
const MIN_DIMENSION = 256;

export interface SelectedImage {
  file: File;
  previewUrl: string;
  meta: ImageMeta;
}

type Phase = 'idle' | 'reading' | 'ready';

export function ImageUpload({
  value,
  onChange,
  error: externalError,
}: {
  value: SelectedImage | null;
  onChange: (image: SelectedImage | null) => void;
  error?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>(value ? 'ready' : 'idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Revoke the preview URL when this component unmounts with an image loaded.
  const previewRef = useRef<string | null>(null);
  previewRef.current = value?.previewUrl ?? null;
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const reject = (message: string) => {
    setError(message);
    setPhase('idle');
    setProgress(0);
  };

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ACCEPTED.includes(file.type as (typeof ACCEPTED)[number])) {
        reject(
          `${file.name || 'That file'} is a ${file.type || 'unrecognised'} file. Use ${ACCEPTED_LABEL}.`,
        );
        return;
      }
      if (file.size > MAX_BYTES) {
        reject(
          `${formatBytes(file.size)} is over the ${formatBytes(MAX_BYTES)} limit. Export the radiograph at a smaller size.`,
        );
        return;
      }
      if (file.size === 0) {
        reject('That file is empty.');
        return;
      }

      setPhase('reading');
      setProgress(0);

      // Decode locally to read the real dimensions. A 40×40 icon is not a
      // chest radiograph, and catching that here is better than downstream.
      const url = URL.createObjectURL(file);
      const dimensions = await new Promise<{ width: number; height: number } | null>((resolve) => {
        const probe = new Image();
        probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
        probe.onerror = () => resolve(null);
        probe.src = url;
      });

      if (!dimensions) {
        URL.revokeObjectURL(url);
        reject('That file could not be decoded as an image. It may be corrupted.');
        return;
      }
      if (dimensions.width < MIN_DIMENSION || dimensions.height < MIN_DIMENSION) {
        URL.revokeObjectURL(url);
        reject(
          `The image is ${dimensions.width}×${dimensions.height}px. A radiograph should be at least ${MIN_DIMENSION}×${MIN_DIMENSION}px.`,
        );
        return;
      }

      // Stepped progress for the local read. Short, and honestly labelled.
      for (const step of [18, 44, 71, 90, 100]) {
        await new Promise((resolve) => window.setTimeout(resolve, 70));
        setProgress(step);
      }

      if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);

      onChange({
        file,
        previewUrl: url,
        meta: {
          fileName: file.name,
          sizeBytes: file.size,
          mimeType: file.type,
          width: dimensions.width,
          height: dimensions.height,
        },
      });
      setPhase('ready');
    },
    [onChange, value],
  );

  const clear = () => {
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
    setPhase('idle');
    setProgress(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const shownError = error ?? externalError ?? null;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {phase === 'ready' && value ? (
        /* Preview + actions */
        <div className="overflow-hidden rounded-card border border-obsidian-200">
          <div className="viewer-grid flex aspect-video items-center justify-center p-3">
            <img
              src={value.previewUrl}
              alt={`Preview of ${value.meta.fileName}`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-obsidian-200 bg-white px-3 py-2.5">
            <FileImage aria-hidden className="size-4 shrink-0 text-obsidian-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-obsidian-900">
                {value.meta.fileName}
              </p>
              <p className="mt-0.5 text-xs text-obsidian-500 tabular">
                {value.meta.width}×{value.meta.height}px · {formatBytes(value.meta.sizeBytes)} ·{' '}
                {value.meta.mimeType.replace('image/', '').toUpperCase()}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="sm"
                variant="outline"
                leadingIcon={<Replace className="size-3.5" />}
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </Button>
              <Button
                size="sm"
                variant="ghost"
                leadingIcon={<Trash2 className="size-3.5" />}
                onClick={clear}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Drop zone */
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={cn(
            'rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors',
            dragging
              ? 'border-ct-500 bg-ct-50'
              : shownError
                ? 'border-urgent-300 bg-urgent-50/40'
                : 'border-obsidian-300 bg-obsidian-50/60',
          )}
        >
          {phase === 'reading' ? (
            <div className="mx-auto max-w-xs">
              <ProgressBar value={progress} label="Reading image on this device" />
              <p className="mt-2.5 text-xs text-obsidian-500">
                The file is being decoded locally. Nothing is being uploaded.
              </p>
            </div>
          ) : (
            <>
              <div
                aria-hidden
                className="mx-auto flex size-10 items-center justify-center rounded-full bg-white text-obsidian-400 ring-1 ring-obsidian-200"
              >
                <Upload className="size-5" />
              </div>
              <p className="mt-3 text-sm font-medium text-obsidian-900">
                Drop the chest X-ray here
              </p>
              <p className="mt-1 text-[13px] text-obsidian-500">
                {ACCEPTED_LABEL}, up to {formatBytes(MAX_BYTES)}
              </p>
              <Button
                className="mt-4"
                variant="primary"
                size="sm"
                leadingIcon={<FileImage className="size-4" />}
                onClick={() => inputRef.current?.click()}
              >
                Choose a file
              </Button>
            </>
          )}
        </div>
      )}

      {shownError ? (
        <div
          role="alert"
          className="mt-2.5 flex items-start gap-2 rounded-md border border-urgent-300/70 bg-urgent-50 px-3 py-2 text-[13px] text-urgent-800"
        >
          <X aria-hidden className="mt-px size-4 shrink-0" />
          <span className="min-w-0">{shownError}</span>
        </div>
      ) : null}

      <Notice tone="demo" compact className="mt-3">
        The radiograph stays on this device until you submit the screening. It is then uploaded to
        private storage, where only the treating team can open it. If you are offline it waits on
        this device until it can be sent.
      </Notice>
    </div>
  );
}
