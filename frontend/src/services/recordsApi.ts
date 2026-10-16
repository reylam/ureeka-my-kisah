/**
 * Records API: every call the pages make, one function each.
 *
 * There is no client-side cache. A page asks for what it shows when it opens
 * (and, for the request list, the queue and the patient's status page, again
 * every few seconds), so what is on screen is what the server holds.
 */

import type {
  ClassLabel,
  ImageQuality,
  LesionRegion,
  Patient,
  PublicStatus,
  QueueDay,
  QueuePriority,
  RequestReceipt,
  Screening,
  ScreeningStatus,
  ScreeningVitals,
  Sex,
  StaffMember,
  SymptomSet,
} from '@/types/domain';
import { api, type PageMeta } from '@/lib/apiClient';

export interface Page<T> {
  items: T[];
  meta: PageMeta | undefined;
}

export interface PatientInput {
  name: string;
  sex: Sex;
  birthDate: string;
  phone: string | null;
  address: string;
}

export interface ExaminationInput {
  symptoms: SymptomSet;
  vitals: ScreeningVitals;
  imageQuality: ImageQuality;
}

export interface BrowserAnalysis {
  probabilities: Record<ClassLabel, number>;
  model: { name: string; version: string; backbone: string };
  regions: LesionRegion[];
}

/* ── Public (no account) ──────────────────────────────────────────────────── */

export const sendRequest = (input: PatientInput & { complaint: string }) =>
  api.post<RequestReceipt>('/public/requests', input);

/** POST, so the code stays out of URLs and server logs. */
export const lookupStatus = (code: string) => api.post<PublicStatus>('/public/result', { code });

/* ── Staff ────────────────────────────────────────────────────────────────── */

export const listStaff = () => api.get<StaffMember[]>('/staff');

export async function listPatients(params: { q?: string; page?: number; pageSize?: number } = {}): Promise<Page<Patient>> {
  const result = await api.getPage<Patient>('/patients', params);
  return { items: result.data, meta: result.meta };
}

export const getPatient = (id: string) => api.get<Patient>(`/patients/${id}`);
export const createPatient = (input: PatientInput) => api.post<Patient>('/patients', input);
export const updatePatient = (id: string, input: PatientInput) => api.patch<Patient>(`/patients/${id}`, input);

export async function listScreenings(
  params: { status?: ScreeningStatus[]; patientId?: string; date?: string; page?: number; pageSize?: number } = {},
): Promise<Page<Screening>> {
  const { status, ...rest } = params;
  const result = await api.getPage<Screening>('/screenings', { ...rest, status: status?.join(',') });
  return { items: result.data, meta: result.meta };
}

export const getScreening = (id: string) => api.get<Screening>(`/screenings/${id}`);

/** A visit registered at the desk for a saved patient. Returns it with its access code. */
export const createRequest = (patientId: string, complaint: string) =>
  api.post<Screening>('/screenings', { patientId, complaint });

export const setRequestPatient = (id: string, patientId: string) =>
  api.put<Screening>(`/screenings/${id}/patient`, { patientId });

export const cancelRequest = (id: string) => api.delete(`/screenings/${id}`);

export const startExamination = (id: string) => api.post<Screening>(`/screenings/${id}/start`);

export const saveExamination = (id: string, input: ExaminationInput) =>
  api.patch<Screening>(`/screenings/${id}`, input);

export function uploadImage(id: string, file: File): Promise<Screening> {
  const form = new FormData();
  form.append('image', file, file.name);
  form.append('fileName', file.name);
  return api.upload<Screening>(`/screenings/${id}/image`, form);
}

export const recordAnalysis = (id: string, analysis: BrowserAnalysis) =>
  api.post<Screening>(`/screenings/${id}/analysis`, {
    probabilities: analysis.probabilities,
    model: analysis.model,
    // The server names the zones itself; it is sent the boxes only.
    regions: analysis.regions.map(({ box, score, label }) => ({ box, score, label: label ?? 'TB' })),
  });

export const submitScreening = (id: string, priority: QueuePriority) =>
  api.post<Screening>(`/screenings/${id}/submit`, { priority });

export const markServed = (id: string) => api.post<Screening>(`/screenings/${id}/served`);

/** Short-lived signed URL for the X-ray. */
export async function getScreeningImageUrl(id: string): Promise<string> {
  const result = await api.get<{ url: string; expiresInSeconds: number }>(`/screenings/${id}/image`);
  return result.url;
}

export const getQueue = (date?: string) => api.get<QueueDay>('/queue', { date });
