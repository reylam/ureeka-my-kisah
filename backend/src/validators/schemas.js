import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';
import {
  CLASS_LABELS,
  IMAGE_QUALITIES,
  QUEUE_PRIORITIES,
  SCREENING_STATUSES,
  SEX,
  birthDate,
  idParam,
  isoDate,
  optionalText,
  searchText,
  shortText,
  strict,
  uuid,
} from './common.js';

export { idParam };

/* ── Patients ───────────────────────────────────────────────────────────── */

const patientFields = {
  name: shortText(200).min(2, 'Nama minimal 2 huruf.'),
  sex: z.enum(SEX),
  birthDate,
  phone: z.string().trim().max(40).nullable().optional(),
  address: optionalText(300).default(''),
};

export const patientCreateBody = strict(patientFields);
export const patientUpdateBody = strict(patientFields);

export const patientListQuery = paginationSchema.extend({
  q: searchText.optional(),
});

/* ── Public request form ────────────────────────────────────────────────── */

// What a patient types without an account. Kept to what the desk needs to
// find or save their record, plus the reason they came.
export const publicRequestBody = strict({
  ...patientFields,
  complaint: optionalText(1000).default(''),
});

export const publicResultBody = strict({
  code: z.string().trim().min(1).max(32),
});

/* ── Screenings ─────────────────────────────────────────────────────────── */

export const screeningListQuery = paginationSchema.extend({
  status: z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(z.enum(SCREENING_STATUSES)).max(4))
    .optional(),
  patientId: uuid.optional(),
  date: isoDate.optional(),
});

// A request registered at the desk, for a saved patient.
export const requestCreateBody = strict({
  patientId: uuid,
  complaint: optionalText(1000).default(''),
});

export const setPatientBody = strict({ patientId: uuid });

const symptomsSchema = strict({
  coughWeeks: z.number().int().min(0).max(520),
  hemoptysis: z.boolean(),
  nightSweats: z.boolean(),
  weightLoss: z.boolean(),
  fever: z.boolean(),
  chestPain: z.boolean(),
  fatigue: z.boolean(),
  appetiteLoss: z.boolean(),
});

const optionalNumber = (min, max) => z.number().min(min).max(max).nullable();

const vitalsSchema = strict({
  weightKg: optionalNumber(1, 500),
  heightCm: optionalNumber(20, 260),
  temperatureC: optionalNumber(30, 45),
  respiratoryRate: optionalNumber(4, 90),
});

export const examinationBody = strict({
  symptoms: symptomsSchema,
  vitals: vitalsSchema,
  imageQuality: z.enum(IMAGE_QUALITIES),
});

// multipart text fields next to the image
export const imageMetaFields = z.object({
  fileName: z.string().trim().max(200).optional(),
});

const probability = z.number().min(0).max(1);
const share = z.number().min(0).max(1);

/**
 * What the model running in the radiologist's browser reports: the three class
 * probabilities, and the areas it leaned on (from occlusion), each grounded to
 * a class. The probabilities must form a distribution; everything derived from
 * them is worked out on the server.
 */
export const browserAnalysisBody = strict({
  probabilities: strict({
    Healthy: probability,
    'Sick-non-TB': probability,
    TB: probability,
  }).refine((p) => Math.abs(p.Healthy + p['Sick-non-TB'] + p.TB - 1) < 0.01, {
    message: 'Probabilities must add up to 1.',
  }),
  model: strict({
    name: shortText(120),
    version: shortText(120),
    backbone: shortText(120),
  }),
  regions: z
    .array(
      strict({
        box: strict({ x: share, y: share, width: share, height: share }).refine(
          (b) => b.width > 0 && b.height > 0 && b.x + b.width <= 1.0001 && b.y + b.height <= 1.0001,
          { message: 'The box must lie inside the image.' },
        ),
        score: share,
        label: z.enum(CLASS_LABELS),
      }),
    )
    .max(5)
    .default([]),
});

export const submitBody = strict({ priority: z.enum(QUEUE_PRIORITIES) });

export const queueQuery = z.object({ date: isoDate.optional() });
