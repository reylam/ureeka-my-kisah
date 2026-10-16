import { z } from 'zod';

/** Reject unknown keys loudly where it matters. */
export const strict = (shape) => z.strictObject(shape);

export const uuid = z.uuid();
export const idParam = z.object({ id: uuid });

export const isoDate = z.iso.date();

const trimmed = (min, max) => z.string().trim().min(min).max(max);
export const shortText = (max = 200) => trimmed(1, max);
export const optionalText = (max = 2000) => z.string().trim().max(max);

export const SEX = ['male', 'female'];
export const SCREENING_STATUSES = ['waiting', 'examining', 'queued', 'served'];
export const QUEUE_PRIORITIES = ['high', 'medium', 'low'];
export const IMAGE_QUALITIES = ['adequate', 'borderline', 'inadequate'];
export const CLASS_LABELS = ['Healthy', 'Sick-non-TB', 'TB'];

export const searchText = z.string().trim().max(80);

/** A birth date: a real calendar date, not in the future, not before 1900. */
export const birthDate = isoDate.refine(
  (value) => value >= '1900-01-01' && value <= new Date().toISOString().slice(0, 10),
  { message: 'Tanggal lahir tidak valid.' },
);
