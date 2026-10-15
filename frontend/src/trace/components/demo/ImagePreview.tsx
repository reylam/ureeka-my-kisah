import { Trash2 } from 'lucide-react';
import type { SelectedImage } from '@/trace/hooks/useImageUpload';
import { formatBytes, splitFilename } from '@/trace/lib/format';
import { TraceButton } from '@/trace/components/ui/TraceButton';
import { cn } from '@/utils/cn';

/**
 * Preview of the selected file, with its measured properties.
 *
 * The dimensions and size are read from the file itself rather than echoed
 * from the input, so what is displayed is what the browser actually decoded.
 * The overlay label states that the image is displayed, not analysed, because
 * a radiograph in a dark technical frame looks exactly like a model is working
 * on it.
 */
export function ImagePreview({
  image,
  onRemove,
  className,
}: {
  image: SelectedImage;
  onRemove: () => void;
  className?: string;
}) {
  const { base, extension } = splitFilename(image.file.name);

  return (
    <figure
      className={cn(
        'overflow-hidden rounded-md border border-trace-line bg-trace-surface',
        className,
      )}
    >
      <div className="relative">
        <div className="trace-grid-fine flex max-h-[460px] items-center justify-center bg-[#0a0c10] p-3">
          <img
            src={image.url}
            alt={`Preview of the selected file ${image.file.name}. Displayed for review only; it has not been analysed.`}
            className="max-h-[430px] w-auto max-w-full object-contain"
          />
        </div>

        {/* No overlay is drawn on a user's image. The placeholder scenarios
            carry no localisation, and dashed circles on someone's radiograph
            would read as a detection result no matter what the caption said. */}
        <p className="absolute top-3 left-3 rounded border border-trace-line bg-[#0a0c10]/85 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-trace-dim">
          Displayed locally · not analysed
        </p>
      </div>

      <figcaption className="border-t border-trace-line">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5 sm:grid-cols-4">
          <div className="col-span-2 min-w-0">
            <dt className="trace-label text-trace-dim">File</dt>
            <dd
              title={image.file.name}
              className="mt-1 truncate font-mono text-[11.5px] text-trace-muted"
            >
              {base}
            </dd>
          </div>
          <div>
            <dt className="trace-label text-trace-dim">Format</dt>
            <dd className="mt-1 font-mono text-[11.5px] text-trace-muted">{extension}</dd>
          </div>
          <div>
            <dt className="trace-label text-trace-dim">Size</dt>
            <dd className="mt-1 font-mono text-[11.5px] text-trace-muted">
              {formatBytes(image.file.size)}
            </dd>
          </div>
          <div>
            <dt className="trace-label text-trace-dim">Dimensions</dt>
            <dd className="mt-1 font-mono text-[11.5px] text-trace-muted">
              {image.width} × {image.height} px
            </dd>
          </div>
          <div>
            <dt className="trace-label text-trace-dim">Aspect</dt>
            <dd className="mt-1 font-mono text-[11.5px] text-trace-muted">
              {(image.width / image.height).toFixed(2)} : 1
            </dd>
          </div>
        </dl>

        <div className="flex items-center justify-between gap-3 border-t border-trace-line px-4 py-3">
          <p className="text-[12.5px] text-trace-dim">
            Held in browser memory only. Nothing is uploaded.
          </p>
          <TraceButton variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 aria-hidden className="size-3.5" />
            Remove
          </TraceButton>
        </div>
      </figcaption>
    </figure>
  );
}
