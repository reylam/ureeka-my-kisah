import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { CountChip } from './Badge';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
  /** Highlights the count when the tab holds work that is overdue or failing. */
  countTone?: 'neutral' | 'urgent' | 'attention';
  icon?: ReactNode;
}

/**
 * Tabs implemented as a proper tablist. Keyboard users get arrow-key movement
 * for free from the roving `tabIndex` plus the key handler below.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  size = 'md',
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const move = (direction: 1 | -1) => {
    const index = items.findIndex((item) => item.id === value);
    const next = (index + direction + items.length) % items.length;
    onChange(items[next]!.id);
  };

  return (
    <div
      role="tablist"
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          move(1);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          move(-1);
        }
      }}
      className={cn(
        'no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-obsidian-200',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative -mb-px inline-flex shrink-0 items-center gap-2 border-b-2 font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-2.5 py-2 text-[13px]' : 'px-3 py-2.5 text-sm',
              selected
                ? 'border-ct-500 text-obsidian-950'
                : 'border-transparent text-obsidian-500 hover:border-obsidian-300 hover:text-obsidian-800',
            )}
          >
            {item.icon ? (
              <span aria-hidden className="[&>svg]:size-4">
                {item.icon}
              </span>
            ) : null}
            {item.label}
            {item.count !== undefined ? (
              <CountChip
                value={item.count}
                tone={selected ? (item.countTone ?? 'neutral') : (item.countTone ?? 'neutral')}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      className={cn('focus-visible:outline-none', className)}
    >
      {children}
    </div>
  );
}
