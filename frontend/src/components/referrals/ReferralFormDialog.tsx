import { useEffect, useMemo, useState } from 'react';
import { Search, Send } from 'lucide-react';
import type { FacilityService, Referral, ReferralPriority } from '@/types/domain';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/forms/Field';
import { RadioGroup, Select, TextArea, TextInput } from '@/components/forms/Inputs';
import { Notice } from '@/components/ui/Notice';
import { useDataStore } from '@/stores/dataStore';
import { toast } from '@/stores/toastStore';
import { facilities, referralTargetIds } from '@/data/facilities';
import { users, assignableWorkerIds } from '@/data/users';
import { facilityServiceLabel, facilityTypeLabel, userRoleLabel } from '@/utils/labels';
import { ageFromBirthDate, dateOffset } from '@/utils/date';
import { formatDistance, formatTravelTime } from '@/utils/format';
import { recordsApi } from '@/services/recordsApi';

/**
 * Create or edit a referral.
 *
 * The destination list is filtered to facilities that actually offer the
 * requested service. Referring someone on a four-hour journey to a place that
 * cannot run the test is the exact failure this screen should prevent.
 */

const SERVICE_OPTIONS: FacilityService[] = [
  'tcm-genexpert',
  'sputum-microscopy',
  'cxr',
  'tb-treatment',
  'mdr-tb-treatment',
  'pediatric-tb',
];

export function ReferralFormDialog({
  open,
  onClose,
  /** Null when opened from the register, where the patient is not known yet. */
  patientId = null,
  screeningId = null,
  /** Pass a referral to edit it instead of creating a new one. */
  referral = null,
  defaultReason = '',
  /** Preselects the destination, e.g. when starting from the facility page. */
  defaultFacilityId = null,
}: {
  open: boolean;
  onClose: () => void;
  patientId?: string | null;
  screeningId?: string | null;
  referral?: Referral | null;
  defaultReason?: string;
  defaultFacilityId?: string | null;
}) {
  const patients = useDataStore((state) => state.patients);

  // When no patient is supplied the dialog asks for one first.
  const [chosenPatientId, setChosenPatientId] = useState<string | null>(patientId);
  const [patientQuery, setPatientQuery] = useState('');

  const effectivePatientId = patientId ?? chosenPatientId;
  const patient = patients.find((p) => p.id === effectivePatientId);

  const editing = Boolean(referral);

  const [requestedService, setRequestedService] = useState<FacilityService>(
    referral?.requestedService ?? 'tcm-genexpert',
  );
  const [toFacilityId, setToFacilityId] = useState(referral?.toFacilityId ?? '');
  const [reason, setReason] = useState(referral?.reason ?? defaultReason);
  const [priority, setPriority] = useState<ReferralPriority>(referral?.priority ?? 'soon');
  const [appointmentDate, setAppointmentDate] = useState(referral?.appointmentDate ?? '');
  const [assignedWorkerId, setAssignedWorkerId] = useState(
    referral?.assignedWorkerId ?? assignableWorkerIds[0]!,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  /** Only facilities that can deliver the requested service. */
  const destinations = useMemo(
    () =>
      facilities
        .filter(
          (facility) =>
            referralTargetIds.includes(facility.id) &&
            facility.services.includes(requestedService),
        )
        .sort((a, b) => a.distanceKm - b.distanceKm),
    [requestedService],
  );

  // Clear a destination that cannot serve the newly chosen service.
  useEffect(() => {
    if (toFacilityId && !destinations.some((facility) => facility.id === toFacilityId)) {
      setToFacilityId('');
    }
  }, [destinations, toFacilityId]);

  // Reset when reopened for a different record.
  useEffect(() => {
    if (!open) return;
    // When a destination is preselected, default the request to a service that
    // facility actually offers, so the two fields never contradict each other.
    const preset = defaultFacilityId
      ? facilities.find((facility) => facility.id === defaultFacilityId)
      : undefined;
    const presetService = preset
      ? (SERVICE_OPTIONS.find((service) => preset.services.includes(service)) ??
        preset.services[0] ??
        'tcm-genexpert')
      : undefined;

    setRequestedService(referral?.requestedService ?? presetService ?? 'tcm-genexpert');
    setToFacilityId(referral?.toFacilityId ?? preset?.id ?? '');
    setReason(referral?.reason ?? defaultReason);
    setPriority(referral?.priority ?? 'soon');
    setAppointmentDate(referral?.appointmentDate ?? '');
    setAssignedWorkerId(referral?.assignedWorkerId ?? assignableWorkerIds[0]!);
    setChosenPatientId(patientId);
    setPatientQuery('');
    setErrors({});
  }, [open, referral, defaultReason, patientId, defaultFacilityId]);

  const matchingPatients = useMemo(() => {
    const term = patientQuery.trim().toLowerCase();
    const pool = term
      ? patients.filter(
          (item) =>
            item.name.toLowerCase().includes(term) ||
            item.mrn.toLowerCase().includes(term) ||
            item.village.toLowerCase().includes(term),
        )
      : patients;
    return pool.slice(0, 6);
  }, [patients, patientQuery]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!effectivePatientId) next.patient = 'Pilih pasien yang dirujuk.';
    if (!toFacilityId) next.facility = 'Pilih fasilitas tujuan.';
    if (reason.trim().length < 12)
      next.reason = 'Jelaskan alasan pasien ini dirujuk. Minimal 12 karakter.';
    if (appointmentDate && appointmentDate < dateOffset(0))
      next.appointmentDate = 'Tanggal janji temu tidak boleh di masa lalu.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (asDraft: boolean) => {
    if (!validate() || !effectivePatientId) return;
    setSaving(true);
    try {
      if (editing && referral) {
        await recordsApi.updateReferral(referral.id, {
          toFacilityId,
          reason: reason.trim(),
          requestedService,
          priority,
          appointmentDate: appointmentDate || null,
          assignedWorkerId,
        });
        toast.success(`${referral.code} diperbarui.`);
      } else {
        const created = await recordsApi.createReferral({
          patientId: effectivePatientId,
          screeningId,
          toFacilityId,
          reason: reason.trim(),
          requestedService,
          priority,
          appointmentDate: appointmentDate || null,
          assignedWorkerId,
          status: asDraft ? 'draft' : 'pending',
        });
        toast.success(
          `Referral ${created.code} ${asDraft ? 'disimpan sebagai draf' : 'dibuat'}.`,
          asDraft
            ? 'Referral belum muncul di queue fasilitas tujuan sampai Anda mengirimnya.'
            : 'Data screening sekarang ditandai sebagai dirujuk.',
        );
      }
      onClose();
    } catch (cause) {
      toast.error('Referral gagal disimpan.', cause instanceof Error ? cause.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const selectedFacility = facilities.find((facility) => facility.id === toFacilityId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? `Ubah referral ${referral?.code}` : 'Buat referral'}
      description={
        patient
          ? `${patient.name} · ${patient.mrn} · ${patient.village}, ${patient.district}`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          {!editing ? (
            <Button variant="outline" disabled={saving} onClick={() => void submit(true)}>
              Simpan sebagai draf
            </Button>
          ) : null}
          <Button
            variant="primary"
            loading={saving}
            leadingIcon={<Send className="size-4" />}
            onClick={() => void submit(false)}
          >
            {editing ? 'Simpan perubahan' : 'Buat referral'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Only shown when the dialog was opened without a patient in context. */}
        {!patientId && !editing ? (
          <Field label="Pasien" error={errors.patient ?? null} required>
            {({ id, describedBy, invalid }) =>
              patient ? (
                <div className="flex items-center gap-3 rounded-md border border-ct-300 bg-ct-50 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-obsidian-900">
                      {patient.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-obsidian-500">
                      <span className="font-mono">{patient.mrn}</span> · {patient.village},{' '}
                      {patient.district}
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setChosenPatientId(null)}>
                    Ganti
                  </Button>
                </div>
              ) : (
                <div>
                  <TextInput
                    id={id}
                    value={patientQuery}
                    onChange={(event) => setPatientQuery(event.target.value)}
                    describedBy={describedBy}
                    invalid={invalid}
                    leadingIcon={<Search />}
                    placeholder="Cari berdasarkan nama, nomor rekam medis, atau desa"
                  />
                  <ul className="mt-2 max-h-56 divide-y divide-obsidian-100 overflow-y-auto rounded-md border border-obsidian-200">
                    {matchingPatients.length === 0 ? (
                      <li className="px-3 py-5 text-center text-[13px] text-obsidian-500">
                        Tidak ada pasien yang cocok dengan pencarian itu.
                      </li>
                    ) : (
                      matchingPatients.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setChosenPatientId(item.id)}
                            className="w-full px-3 py-2 text-left transition-colors hover:bg-obsidian-50"
                          >
                            <span className="block truncate text-[13px] font-medium text-obsidian-900">
                              {item.name}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-obsidian-500">
                              <span className="font-mono">{item.mrn}</span> ·{' '}
                              {ageFromBirthDate(item.birthDate)} th · {item.village}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )
            }
          </Field>
        ) : null}

        <Field
          label="Layanan yang diminta"
          hint="Daftar tujuan di bawah hanya menampilkan fasilitas yang menyediakan layanan ini."
          required
        >
          {({ id }) => (
            <Select
              id={id}
              value={requestedService}
              onChange={(event) => setRequestedService(event.target.value as FacilityService)}
            >
              {SERVICE_OPTIONS.map((service) => (
                <option key={service} value={service}>
                  {facilityServiceLabel[service]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Fasilitas tujuan"
          error={errors.facility ?? null}
          required
          hint={
            destinations.length === 0
              ? 'Tidak ada fasilitas di direktori contoh yang menyediakan layanan ini.'
              : `${destinations.length} fasilitas menyediakan layanan ini, diurutkan dari yang terdekat.`
          }
        >
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              value={toFacilityId}
              onChange={(event) => setToFacilityId(event.target.value)}
              describedBy={describedBy}
              invalid={invalid}
              disabled={destinations.length === 0}
            >
              <option value="">Pilih fasilitas</option>
              {destinations.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name} · {formatDistance(facility.distanceKm)} ·{' '}
                  {facilityTypeLabel[facility.type]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {selectedFacility ? (
          <div className="rounded-md border border-obsidian-200 bg-obsidian-50/70 px-3.5 py-3 text-[13px]">
            <p className="font-medium text-obsidian-900">{selectedFacility.name}</p>
            <p className="mt-1 text-obsidian-600">{selectedFacility.address}</p>
            <p className="mt-1.5 text-obsidian-500 tabular">
              {formatDistance(selectedFacility.distanceKm)} ·{' '}
              {formatTravelTime(selectedFacility.travelTimeMinutes)} perjalanan ·{' '}
              {selectedFacility.operatingHours}
            </p>
            <p className="mt-1.5 text-obsidian-500">
              {selectedFacility.tbProgrammeContact
                ? `Kontak program TB: ${selectedFacility.tbProgrammeContact}`
                : 'Belum ada nama kontak program TB.'}
            </p>
            <p className="mt-2 text-[11px] text-obsidian-400">
              Entri direktori contoh. Jarak, jam operasional, dan kontak hanya ilustrasi, belum diverifikasi.
            </p>
          </div>
        ) : null}

        <Field label="Alasan rujukan" error={errors.reason ?? null} required>
          {({ id, describedBy, invalid }) => (
            <TextArea
              id={id}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              describedBy={describedBy}
              invalid={invalid}
              rows={3}
              placeholder="Konteks klinis yang dibutuhkan fasilitas penerima."
            />
          )}
        </Field>

        <Field label="Prioritas" required>
          {() => (
            <RadioGroup<ReferralPriority>
              name="priority"
              value={priority}
              onChange={setPriority}
              options={[
                { value: 'routine', label: 'Rutin', description: 'Tidak mendesak.' },
                {
                  value: 'soon',
                  label: 'Segera',
                  description: 'Sebaiknya ditangani dalam beberapa minggu ke depan.',
                },
                {
                  value: 'urgent',
                  label: 'Mendesak',
                  description: 'Perlu ditangani dalam beberapa hari ke depan.',
                },
              ]}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Tanggal janji temu"
            optional
            error={errors.appointmentDate ?? null}
            hint="Kosongkan jika belum dijadwalkan."
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                type="date"
                min={dateOffset(0)}
                value={appointmentDate}
                onChange={(event) => setAppointmentDate(event.target.value)}
                describedBy={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Field label="Petugas penanggung jawab" required hint="Yang memantau referral ini.">
            {({ id }) => (
              <Select
                id={id}
                value={assignedWorkerId}
                onChange={(event) => setAssignedWorkerId(event.target.value)}
              >
                {assignableWorkerIds.map((workerId) => {
                  const worker = users.find((u) => u.id === workerId)!;
                  return (
                    <option key={workerId} value={workerId}>
                      {worker.name} ({userRoleLabel[worker.role]})
                    </option>
                  );
                })}
              </Select>
            )}
          </Field>
        </div>

        <Notice tone="demo" compact>
          Membuat referral hanya memperbarui data di perangkat ini. Tidak ada pesan yang dikirim
          ke fasilitas mana pun, dan tidak ada yang diberi notifikasi.
        </Notice>
      </div>
    </Dialog>
  );
}
