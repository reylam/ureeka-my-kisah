/** Shared types for the PARUPINTAS site. */

export interface Source {
  id: string;
  /** Short form used inline, e.g. "Global tuberculosis report 2025". */
  label: string;
  publisher: string;
  year: number;
  url: string;
  /** Why this source is cited, in one plain line. */
  note: string;
}
