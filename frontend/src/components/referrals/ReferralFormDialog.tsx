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
    if (!effectivePatientId) next.patient = 'Choose the patient being referred.';
    if (!toFacilityId) next.facility = 'Choose a destination facility.';
    if (reason.trim().length < 12)
      next.reason = 'Explain why this patient is being referred. At least 12 characters.';
    if (appointmentDate && appointmentDate < dateOffset(0))
      next.appointmentDate = 'An appointment date cannot be in the past.';
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
        toast.success(`${referral.code} updated.`);
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
          `Referral ${created.code} ${asDraft ? 'saved as a draft' : 'created'}.`,
          asDraft
            ? 'It will not appear in the destination facility’s queue until you submit it.'
            : 'The screening record is now marked as referred.',
        );
      }
      onClose();
    } catch (cause) {
      toast.error('The referral could not be saved.', cause instanceof Error ? cause.message : undefined);
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
      title={editing ? `Edit referral ${referral?.code}` : 'Create a referral'}
      description={
        patient
          ? `${patient.name} · ${patient.mrn} · ${patient.village}, ${patient.district}`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {!editing ? (
            <Button variant="outline" disabled={saving} onClick={() => void submit(true)}>
              Save as draft
            </Button>
          ) : null}
          <Button
            variant="primary"
            loading={saving}
            leadingIcon={<Send className="size-4" />}
            onClick={() => void submit(false)}
          >
            {editing ? 'Save changes' : 'Create referral'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Only shown when the dialog was opened without a patient in context. */}
        {!patientId && !editing ? (
          <Field label="Patient" error={errors.patient ?? null} required>
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
                    Change
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
                    placeholder="Search by name, record number or village"
                  />
                  <ul className="mt-2 max-h-56 divide-y divide-obsidian-100 overflow-y-auto rounded-md border border-obsidian-200">
                    {matchingPatients.length === 0 ? (
                      <li className="px-3 py-5 text-center text-[13px] text-obsidian-500">
                        No patient matches that search.
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
                              {ageFromBirthDate(item.birthDate)} yrs · {item.village}
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
          label="What is being requested"
          hint="The destination list below only shows facilities that offer this."
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
          label="Destination facility"
          error={errors.facility ?? null}
          required
          hint={
            destinations.length === 0
              ? 'No facility in the sample directory offers this service.'
              : `${destinations.length} facilities offer this, nearest first.`
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
              <option value="">Select a facility</option>
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
              {formatTravelTime(selectedFacility.travelTimeMinutes)} travel ·{' '}
              {selectedFacility.operatingHours}
            </p>
            <p className="mt-1.5 text-obsidian-500">
              {selectedFacility.tbProgrammeContact
                ? `TB programme contact: ${selectedFacility.tbProgrammeContact}`
                : 'No named TB programme contact on file.'}
            </p>
            <p className="mt-2 text-[11px] text-obsidian-400">
              Sample directory entry. Distances, hours and contacts are illustrative, not verified.
            </p>
          </div>
        ) : null}

        <Field label="Reason for referral" error={errors.reason ?? null} required>
          {({ id, describedBy, invalid }) => (
            <TextArea
              id={id}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              describedBy={describedBy}
              invalid={invalid}
              rows={3}
              placeholder="Clinical context the receiving facility needs."
            />
          )}
        </Field>

        <Field label="Priority" required>
          {() => (
            <RadioGroup<ReferralPriority>
              name="priority"
              value={priority}
              onChange={setPriority}
              options={[
                { value: 'routine', label: 'Routine', description: 'No time pressure.' },
                {
                  value: 'soon',
                  label: 'Soon',
                  description: 'Should be seen within the next couple of weeks.',
                },
                {
                  value: 'urgent',
                  label: 'Urgent',
                  description: 'Needs attention in the next few days.',
                },
              ]}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Appointment date"
            optional
            error={errors.appointmentDate ?? null}
            hint="Leave blank if it has not been booked yet."
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

          <Field label="Assigned worker" required hint="Who chases this referral.">
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
          Creating a referral updates records on this device only. No message is sent to any
          facility, and nobody is notified.
        </Notice>
      </div>
    </Dialog>
  );
}
