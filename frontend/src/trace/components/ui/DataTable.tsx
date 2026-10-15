import type { ReactNode } from 'react';
import type { FieldRow } from '@/trace/types';
import { ProvenanceBadge } from './ProvenanceBadge';
import { cn } from '@/utils/cn';

/**
 * Research tables.
 *
 * Two shapes cover everything on this site: a generic column table, and a
 * field/value documentation table. Both share one treatment — hairline rules,
 * tabular figures, a mono header, a scroll container on narrow screens, and a
 * real `<caption>` so the table announces its own provenance to a screen
 * reader rather than relying on a badge floating nearby.
 */

export interface Column<Row> {
  key: string;
  header: ReactNode;
  /** Right-align numeric columns so digits line up. */
  numeric?: boolean;
  width?: string;
  render: (row: Row) => ReactNode;
}

export function DataTable<Row>({
  columns,
  rows,
  caption,
  rowKey,
  highlight,
  className,
}: {
  columns: Column<Row>[];
  rows: Row[];
  caption?: ReactNode;
  rowKey: (row: Row, index: number) => string;
  /** Marks a row as the selected or recommended one. */
  highlight?: (row: Row) => boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-trace-line bg-trace-card',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13.5px]">
          {caption ? (
            <caption className="caption-bottom border-t border-trace-line px-4 py-3 text-left text-xs text-trace-dim">
              {caption}
            </caption>
          ) : null}
          <thead>
            <tr className="bg-trace-raised">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    'trace-label whitespace-nowrap px-4 py-2.5 font-normal text-trace-dim',
                    column.numeric && 'text-right',
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                className={cn(
                  'border-t border-trace-line-soft align-top',
                  highlight?.(row) && 'bg-trace-accent-surface/45',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 text-trace-muted',
                      column.numeric && 'text-right font-mono tabular-nums text-trace-text',
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Field / value / provenance documentation table. Used for the dataset record,
 * the model configuration and the project metadata panel.
 */
export function FieldTable({
  rows,
  caption,
  className,
}: {
  rows: FieldRow[];
  caption?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-trace-line bg-trace-card',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13.5px]">
          {caption ? (
            <caption className="caption-bottom border-t border-trace-line px-4 py-3 text-left text-xs text-trace-dim">
              {caption}
            </caption>
          ) : null}
          <thead>
            <tr className="bg-trace-raised">
              <th scope="col" className="trace-label px-4 py-2.5 font-normal text-trace-dim">
                Field
              </th>
              <th scope="col" className="trace-label px-4 py-2.5 font-normal text-trace-dim">
                Value
              </th>
              <th
                scope="col"
                className="trace-label px-4 py-2.5 text-right font-normal text-trace-dim"
              >
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.field} className="border-t border-trace-line-soft align-top">
                <th
                  scope="row"
                  className="w-[30%] min-w-[150px] px-4 py-3 text-left font-medium text-trace-text"
                >
                  {row.field}
                </th>
                <td className="px-4 py-3 text-trace-muted">
                  <span
                    className={cn(
                      row.provenance === 'not-computed' && 'italic text-trace-dim',
                    )}
                  >
                    {row.value}
                  </span>
                  {row.note ? (
                    <span className="mt-1 block text-[12.5px] leading-5 text-trace-dim">
                      {row.note}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">
                  <ProvenanceBadge provenance={row.provenance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
