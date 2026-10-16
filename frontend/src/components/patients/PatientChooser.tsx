import { useEffect, useState } from 'react';
import { RadioGroup, SearchInput } from '@/components/forms/Inputs';
import { PatientFields } from './PatientFields';
import {
  EMPTY_PATIENT_DRAFT,
  patientInputFromDraft,
  validatePatientDraft,
  type PatientDraft,
  type PatientDraftErrors,
} from './patientDraft';
import type { Patient } from '@/types/domain';
import { createPatient, listPatients } from '@/services/recordsApi';
import { errorMessage } from '@/lib/apiClient';
import { ageFromBirthDate, formatDate } from '@/utils/date';
import { sexLabel } from '@/utils/labels';

/**
 * "Which patient is this?" Pick a saved patient, or save a new one.
 *
 * Used where the administrator saves the person behind a request from the
 * public form (the form's answers start both the search and the new-patient
 * fields, so a returning patient is found instead of saved twice), and where
 * staff register a walk-in at the desk.
 */

export interface PatientChooserState {
  mode: 'existing' | 'new';
  setMode: (mode: 'existing' | 'new') => void;
  query: string;
  setQuery: (query: string) => void;
  selected: Patient | null;
  setSelected: (patient: Patient | null) => void;
  draft: PatientDraft;
  setDraft: (patch: Partial<PatientDraft>) => void;
  errors: PatientDraftErrors;
  /** The chosen patient, saving a new one first. Null (with errors shown) when incomplete. */
  resolve: () => Promise<Patient | null>;
}

export function usePatientChooser(initial?: { draft?: PatientDraft; query?: string }): PatientChooserState {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [query, setQuery] = useState(initial?.query ?? '');
  const [selected, setSelected] = useState<Patient | null>(null);
  const [draft, setDraftState] = useState<PatientDraft>(initial?.draft ?? EMPTY_PATIENT_DRAFT);
  const [errors, setErrors] = useState<PatientDraftErrors>({});

  return {
    mode,
    setMode,
    query,
    setQuery,
    selected,
    setSelected,
    draft,
    setDraft: (patch) => setDraftState((current) => ({ ...current, ...patch })),
    errors,
    resolve: async () => {
      if (mode === 'existing') return selected;
      const found = validatePatientDraft(draft);
      setErrors(found);
      if (Object.keys(found).length > 0) return null;
      return createPatient(patientInputFromDraft(draft));
    },
  };
}

export function PatientChooser({ state, disabled = false }: { state: PatientChooserState; disabled?: boolean }) {
  const [candidates, setCandidates] = useState<Patient[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const { mode, query } = state;

  useEffect(() => {
    if (mode !== 'existing') return undefined;
    let active = true;
    const timer = window.setTimeout(
      () => {
        listPatients({ q: query.trim() || undefined, pageSize: 8 })
          .then((page) => {
            if (!active) return;
            setCandidates(page.items);
            setFailure(null);
          })
          .catch((cause: unknown) => active && setFailure(errorMessage(cause, 'Daftar pasien gagal dimuat.')));
      },
      query ? 250 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [mode, query]);

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Sumber data pasien" className="inline-flex rounded-md bg-obsidian-100 p-0.5">
        {(
          [
            ['existing', 'Pasien tersimpan'],
            ['new', 'Simpan pasien baru'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            aria-pressed={mode === value}
            onClick={() => state.setMode(value)}
            className={
              mode === value
                ? 'rounded bg-white px-3 py-1.5 text-xs font-medium text-obsidian-950 shadow-sm'
                : 'rounded px-3 py-1.5 text-xs text-obsidian-600 hover:text-obsidian-950'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'existing' ? (
        <div className="space-y-3">
          <SearchInput label="Cari pasien" placeholder="Nama, nomor rekam medis, atau telepon" value={query} onChange={state.setQuery} />
          {failure ? (
            <p className="text-[13px] text-urgent-700">{failure}</p>
          ) : candidates === null ? (
            <p className="text-[13px] text-obsidian-500">Memuat daftar pasien…</p>
          ) : candidates.length === 0 ? (
            <p className="text-[13px] text-obsidian-500">
              Tidak ada pasien yang cocok.{' '}
              <button type="button" onClick={() => state.setMode('new')} className="font-medium text-ct-700 underline underline-offset-2">
                Simpan sebagai pasien baru
              </button>
            </p>
          ) : (
            <RadioGroup
              name="patient"
              value={state.selected?.id ?? null}
              onChange={(id) => state.setSelected(candidates.find((item) => item.id === id) ?? null)}
              options={candidates.map((item) => ({
                value: item.id,
                label: item.name,
                description: `${item.mrn} · ${sexLabel[item.sex]} · ${ageFromBirthDate(item.birthDate)} th (${formatDate(item.birthDate)})${
                  item.phone ? ` · ${item.phone}` : ''
                }`,
              }))}
            />
          )}
        </div>
      ) : (
        <PatientFields draft={state.draft} errors={state.errors} disabled={disabled} onChange={state.setDraft} />
      )}
    </div>
  );
}
