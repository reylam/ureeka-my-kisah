import { Field } from '@/components/forms/Field';
import { Select, TextArea, TextInput } from '@/components/forms/Inputs';
import type { PatientDraft, PatientDraftErrors } from './patientDraft';

/**
 * The patient's data as one block of fields. Used where the administrator
 * saves a patient and where the radiologist completes one during an
 * examination, so the two cannot drift apart.
 */
export function PatientFields({
  draft,
  errors,
  onChange,
  disabled = false,
}: {
  draft: PatientDraft;
  errors: PatientDraftErrors;
  onChange: (patch: Partial<PatientDraft>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nama lengkap" error={errors.name ?? null} required className="sm:col-span-2">
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            autoComplete="off"
            value={draft.name}
            disabled={disabled}
            describedBy={describedBy}
            invalid={invalid}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Siti Rahmawati"
          />
        )}
      </Field>

      <Field label="Jenis kelamin" error={errors.sex ?? null} required>
        {({ id, describedBy, invalid }) => (
          <Select
            id={id}
            value={draft.sex}
            disabled={disabled}
            describedBy={describedBy}
            invalid={invalid}
            onChange={(event) => onChange({ sex: event.target.value as PatientDraft['sex'] })}
          >
            <option value="">Pilih</option>
            <option value="female">Perempuan</option>
            <option value="male">Laki-laki</option>
          </Select>
        )}
      </Field>

      <Field label="Tanggal lahir" error={errors.birthDate ?? null} required>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            type="date"
            value={draft.birthDate}
            disabled={disabled}
            describedBy={describedBy}
            invalid={invalid}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => onChange({ birthDate: event.target.value })}
          />
        )}
      </Field>

      <Field label="Nomor telepon" error={errors.phone ?? null} optional className="sm:col-span-2">
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            type="tel"
            inputMode="tel"
            value={draft.phone}
            disabled={disabled}
            describedBy={describedBy}
            invalid={invalid}
            onChange={(event) => onChange({ phone: event.target.value })}
            placeholder="0812-0000-0000"
          />
        )}
      </Field>

      <Field label="Alamat" error={errors.address ?? null} optional className="sm:col-span-2">
        {({ id, describedBy, invalid }) => (
          <TextArea
            id={id}
            rows={2}
            value={draft.address}
            disabled={disabled}
            describedBy={describedBy}
            invalid={invalid}
            onChange={(event) => onChange({ address: event.target.value })}
            placeholder="Desa, kecamatan"
          />
        )}
      </Field>
    </div>
  );
}
