import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore, type ToastTone } from '@/stores/toastStore';
import { cn } from '@/utils/cn';

/**
 * Toast region.
 *
 * Lives in an `aria-live` container so screen readers announce confirmations
 * without stealing focus. Urgent toasts are `assertive`; everything else is
 * polite.
 */

const toneConfig: Record<ToastTone, { icon: React.ReactNode; classes: string; iconClasses: string }> =
  {
    neutral: {
      icon: <Info />,
      classes: 'border-obsidian-200 bg-white',
      iconClasses: 'text-ct-700',
    },
    success: {
      icon: <CheckCircle2 />,
      classes: 'border-complete-300/70 bg-white',
      iconClasses: 'text-complete-700',
    },
    attention: {
      icon: <AlertTriangle />,
      classes: 'border-attention-300/70 bg-white',
      iconClasses: 'text-attention-700',
    },
    urgent: {
      icon: <XCircle />,
      classes: 'border-urgent-300/70 bg-white',
      iconClasses: 'text-urgent-700',
    },
  };

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:bottom-0 sm:items-end"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => {
          const config = toneConfig[item.tone];
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0.2, 1] }}
              role={item.tone === 'urgent' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-3.5 py-3 shadow-overlay',
                config.classes,
              )}
            >
              <span aria-hidden className={cn('mt-px shrink-0 [&>svg]:size-4', config.iconClasses)}>
                {config.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-obsidian-950">{item.title}</p>
                {item.description ? (
                  <p className="mt-1 text-xs leading-relaxed text-obsidian-600">
                    {item.description}
                  </p>
                ) : null}
                {item.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      item.action?.onClick();
                      dismiss(item.id);
                    }}
                    className="mt-2 text-xs font-medium text-ct-700 underline decoration-ct-300 underline-offset-2 transition-colors hover:text-ct-800"
                  >
                    {item.action.label}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="-mt-0.5 -mr-1 flex size-6 shrink-0 items-center justify-center rounded text-obsidian-400 transition-colors hover:bg-obsidian-100 hover:text-obsidian-700"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
