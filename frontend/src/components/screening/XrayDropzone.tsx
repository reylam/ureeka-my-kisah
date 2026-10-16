import { useRef, useState } from 'react';
import { ImageUp, Loader2, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { formatBytes } from '@/utils/format';
import type { SelectedImage, UploadError } from '@/trace/hooks/useImageUpload';

/**
 * Where the radiologist drops the chest X-ray.
 *
 * The file is checked in the browser first (type, size, dimensions) by
 * `useImageUpload`, and a preview is drawn from it. Nothing leaves the device
 * until the radiologist presses the check button, which uploads it to the
 * record and has the model read it.
 */
export function XrayDropzone({
  image,
  error,
  reading,
  disabled = false,
  onSelect,
  onClear,
}: {
  image: SelectedImage | null;
  error: UploadError | null;
  reading: boolean;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onSelect(file);
  };

  return (
    <div className="space-y-3">
      {image ? (
        <div className="overflow-hidden rounded-card border border-obsidian-200 bg-obsidian-950">
          <div className="viewer-grid flex max-h-[26rem] items-center justify-center">
            <img src={image.url} alt="Pratinjau rontgen dada yang dipilih" className="max-h-[26rem] w-auto object-contain" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-3 py-2 text-xs text-obsidian-300">
            <span className="min-w-0 truncate font-mono" title={image.file.name}>
              {image.file.name}
            </span>
            <span className="flex items-center gap-3">
              <span className="tabular">
                {image.width} × {image.height} px · {formatBytes(image.file.size)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={onClear}
                leadingIcon={<X className="mr-1 size-3.5" />}
                className="text-obsidian-200 hover:bg-white/10"
              >
                Ganti gambar
              </Button>
            </span>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!disabled) pick(event.dataTransfer.files);
          }}
          className={cn(
            'flex flex-col items-center justify-center rounded-card border border-dashed px-6 py-10 text-center transition-colors',
            dragging ? 'border-ct-500 bg-ct-50' : 'border-obsidian-300 bg-obsidian-50/60',
            disabled && 'opacity-60',
          )}
        >
          <span
            aria-hidden
            className="mb-3 flex size-11 items-center justify-center rounded-full border border-obsidian-200 bg-white text-obsidian-500"
          >
            {reading ? <Loader2 className="size-5 animate-spin" /> : <ImageUp className="size-5" />}
          </span>
          <p className="text-sm font-medium text-obsidian-900">Letakkan rontgen dada di sini</p>
          <p className="mt-1 text-[13px] text-obsidian-500">
            atau{' '}
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="font-medium text-ct-700 underline underline-offset-2 hover:text-ct-800 disabled:no-underline"
            >
              pilih dari perangkat
            </button>
          </p>
          <p className="mt-3 font-mono text-[11.5px] text-obsidian-400">
            JPG · PNG · maks 15 MB · sisi terpendek minimal 256 px
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        aria-label="Pilih file rontgen dada"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          pick(event.target.files);
          // Allow choosing the same file again after clearing it.
          event.target.value = '';
        }}
      />

      {error ? (
        <Notice tone="urgent" compact>
          {error.message}
        </Notice>
      ) : null}
    </div>
  );
}
