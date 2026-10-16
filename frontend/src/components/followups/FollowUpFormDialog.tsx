import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Search } from 'lucide-react';
import type { FollowUp, FollowUpReason } from '@/types/domain';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/forms/Field';
import { Select, TextArea, TextInput } from '@/components/forms/Inputs';
import { Notice } from '@/components/ui/Notice';
import { useDataStore } from '@/stores/dataStore';
import { toast } from '@/stores/toastStore';
import { users, assignableWorkerIds } from '@/data/users';
import { followUpReasonLabel, userRoleLabel } from '@/utils/labels';
import { dateOffset, formatDueLabel } from '@/utils/date';
import { recordsApi } from '@/services/recordsApi';

/**
 * Schedule or reschedule a follow-up.
 *
 * Rescheduling is kept in the same dialog as scheduling because the fields are
 * identical; only the wording and the resulting store action differ.
 */

const REASONS: FollowUpReason[] = [
  'referral-attendance',
  'sputum-result',
  'repeat-imaging',
  'treatment-adherence',
  'contact-tracing',
  'symptom-recheck',
];

export function FollowUpFormDialog({
  open,
  onClose,
  /** Null when opened from the tracker, where the patient is not known yet. */
  patientId = null,
  referralId = null,
  screeningId = null,
  /** Pass an existing follow-up to reschedule it. */
  followUp = null,
  defaultReason,
}: {
  open: boolean;
  onClose: () => void;
  patientId?: string | null;
  referralId?: string | null;
  screeningId?: string | null;
  followUp?: FollowUp | null;
  defaultReason?: FollowUpReason;
}) {
  const patients = useDataStore((state) => state.patients);
  const rescheduleFollowUp = useDataStore((state) => state.rescheduleFollowUp);

  const [chosenPatientId, setChosenPatientId] = useState<string | null>(patientId);
  const [patientQuery, setPatientQuery] = useState('');

  const effectivePatientId = patientId ?? chosenPatientId;
  const patient = patients.find((p) => p.id === effectivePatientId);

  const editing = Boolean(followUp);

  const [reason, setReason] = useState<FollowUpReason>(
    followUp?.reason ?? defaultReason ?? 'referral-attendance',
  );
  const [dueDate, setDueDate] = useState(followUp?.dueDate ?? dateOffset(7));
  const [assignedWorkerId, setAssignedWorkerId] = useState(
    followUp?.assignedWorkerId ?? assignableWorkerIds[0]!,
  );
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason(followUp?.reason ?? defaultReason ?? 'referral-attendance');
    setDueDate(followUp?.dueDate ?? dateOffset(7));
    setAssignedWorkerId(followUp?.assignedWorkerId ?? assignableWorkerIds[0]!);
    setChosenPatientId(patientId);
    setPatientQuery('');
    setNote('');
    setErrors({});
  }, [open, followUp, defaultReason, patientId]);

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
    if (!effectivePatientId) next.patient = 'Pilih pasien untuk tugas ini.';
    if (!dueDate) next.dueDate = 'Pilih tanggal jatuh tempo.';
    else if (!editing && dueDate < dateOffset(0))
      next.dueDate = 'Follow-up baru tidak bisa jatuh tempo di masa lalu.';
    if (editing && note.trim().length > 0 && note.trim().length < 5)
      next.note = 'Kosongkan catatan, atau tulis sesuatu yang berguna.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate() || !effectivePatientId) return;
    setSaving(true);
    try {
      if (editing && followUp) {
        await rescheduleFollowUp(followUp.id, dueDate, note.trim() || undefined);
        if (assignedWorkerId !== followUp.assignedWorkerId) {
          await recordsApi.updateFollowUp(followUp.id, { assignedWorkerId });
        }
        toast.success(
          `${followUp.code} dijadwalkan ulang ke ${formatDueLabel(dueDate).toLowerCase()}.`,
        );
      } else {
        const created = await recordsApi.createFollowUp({
          patientId: effectivePatientId,
          referralId,
          screeningId,
          reason,
          dueDate,
          assignedWorkerId,
        });
        toast.success(
          `Follow-up ${created.code} dijadwalkan.`,
          `${followUpReasonLabel[reason]} · ${formatDueLabel(dueDate).toLowerCase()}.`,
        );
      }
      onClose();
    } catch (cause) {
      toast.error('Follow-up gagal disimpan.', cause instanceof Error ? cause.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Jadwalkan ulang ${followUp?.code}` : 'Jadwalkan follow-up'}
      description={patient ? `${patient.name} · ${patient.mrn}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button
            variant="primary"
            loading={saving}
            leadingIcon={<CalendarClock className="size-4" />}
            onClick={() => void submit()}
          >
            {editing ? 'Jadwalkan ulang' : 'Jadwalkan follow-up'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Only shown when opened without a patient in context. */}
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
                      <span className="font-mono">{patient.mrn}</span> · {patient.village}
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
                              <span className="font-mono">{item.mrn}</span> · {item.village}
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

        <Field label="Alasan" required>
          {({ id }) => (
            <Select
              id={id}
              value={reason}
              onChange={(event) => setReason(event.target.value as FollowUpReason)}
              disabled={editing}
            >
              {REASONS.map((item) => (
                <option key={item} value={item}>
                  {followUpReasonLabel[item]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Tanggal jatuh tempo"
          error={errors.dueDate ?? null}
          required
          hint={dueDate ? formatDueLabel(dueDate) : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              describedBy={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label="Ditugaskan ke" required>
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

        {editing ? (
          <Field label="Kenapa dijadwalkan ulang?" optional error={errors.note ?? null}>
            {({ id, describedBy, invalid }) => (
              <TextArea
                id={id}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                describedBy={describedBy}
                invalid={invalid}
                rows={2}
                placeholder="mis. Pasien minta diundur karena sedang musim panen."
              />
            )}
          </Field>
        ) : null}

        <Notice tone="demo" compact>
          Follow-up hanyalah daftar kerja lokal. Prototipe ini tidak mengirim pengingat, SMS, atau
          panggilan ke pasien.
        </Notice>
      </div>
    </Dialog>
  );
}
