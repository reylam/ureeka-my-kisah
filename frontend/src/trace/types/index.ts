/**
 * Shared types for the PULMO-TRACE research site.
 *
 * The important one is `Provenance`. Every figure, table and chart on the site
 * carries one and the UI renders a matching badge, so a reader never has to
 * guess whether a number came from an experiment or from a mock data file.
 *
 * In this build almost everything is `illustrative`: the site is a frontend
 * prototype and no model is wired to it.
 */

export type Provenance =
  /** Invented for layout and teaching. Not a measurement of anything. */
  | 'illustrative'
  /** Would be meaningful, but has not been computed. */
  | 'not-computed'
  /** Documented from an external, citable publication. */
  | 'external';

export interface Source {
  id: string;
  /** Short form used inline, e.g. "WHO Global TB Report 2025". */
  label: string;
  publisher: string;
  year: number;
  url: string;
  /** Why this source is cited, in one line. */
  note: string;
}

/** A row in a documentation table: field, value, and how sure we are. */
export interface FieldRow {
  field: string;
  value: string;
  provenance: Provenance;
  note?: string;
}

export interface MetricValue {
  key: string;
  label: string;
  /** Pre-formatted for display so the page never rounds twice. */
  value: string;
  /** Raw value where a bar or chart needs it. 0–1 for rates. */
  raw?: number;
  provenance: Provenance;
  caption: string;
}

export interface ConfusionMatrixData {
  /** rows = reference label, columns = predicted label */
  classNames: string[];
  counts: number[][];
  provenance: Provenance;
  support: number;
}

export interface PipelineStage {
  id: string;
  label: string;
  description: string;
  /** Separates what this prototype does from what is only planned. */
  status: 'in-prototype' | 'planned';
}

export interface ResearchQuestion {
  id: 'RQ1' | 'RQ2' | 'RQ3';
  shortLabel: string;
  title: string;
  question: string;
  hypothesis: string;
  criteria: string[];
  /** Honest statement of where the question currently stands. */
  state: string;
}

export interface Point {
  x: number;
  y: number;
}
