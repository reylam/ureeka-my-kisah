import { useEffect, useState } from 'react';
import { CheckCircle2, CircleSlash, PhoneCall } from 'lucide-react';
import type { ContactAttempt, ContactChannel, FollowUp } from '@/types/domain';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/forms/Field';
import { RadioGroup, Select, TextArea } from '@/components/forms/Inputs';
import { Notice } from '@/components/ui/Notice';
import { useDataStore } from '@/stores/dataStore';
import { toast } from '@/stores/toastStore';
import { contactChannelLabel } from '@/utils/labels';

/**
 * The three things a worker does to a follow-up besides rescheduling it:
 * record an attempt to reach the patient, close it, or declare that it cannot
 * be closed. Each is a separate deliberate action with its own required field,
 * because "unresolved" without a reason is useless to whoever picks it up next.
 */

type Outcome = ContactAttempt['outcome'];

const CHANNELS: ContactChannel[] = ['phone', 'home-visit', 'village-cadre', 'sms'];

export function ContactAttemptDialog({
  open,
  onClose,
  followUp,
}: {
  open: boolean;
  onClose: () => void;
  followUp: FollowUp;
}) {
  const logContactAttempt = useDataStore((state) => state.logContactAttempt);
  const patient = useDataStore((state) =>
    state.patients.find((item) => item.id === followUp.patientId),
  );

  const [channel, setChannel] = useState<ContactChannel>(patient?.phone ? 'phone' : 'home-visit');
  const [outcome, setOutcome] = useState<Outcome>('reached');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChannel(patient?.phone ? 'phone' : 'home-visit');
    setOutcome('reached');
    setNote('');
    setError(null);
  }, [open, patient?.phone]);

  const submit = async () => {
    // A failed attempt is only useful if it says what happened.
    if (outcome !== 'reached' && note.trim().length < 5) {
      setError('Jelaskan apa yang terjadi, supaya percobaan berikutnya lebih terarah.');
      return;
    }
    try {
      await logContactAttempt(followUp.id, channel, outcome, note.trim() || null);
      toast.success(
        'Upaya kontak dicatat.',
        outcome === 'reached'
          ? 'Follow-up sekarang berstatus sedang berjalan.'
          : 'Follow-up tetap terbuka untuk upaya berikutnya.',
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upaya kontak gagal disimpan.');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Catat upaya kontak untuk ${followUp.code}`}
      description={
        patient
          ? `${patient.name} · ${patient.phone ?? 'belum ada nomor telepon'}`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            leadingIcon={<PhoneCall className="size-4" />}
            onClick={submit}
          >
            Catat upaya
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Bagaimana Anda mencoba menghubungi pasien?" required>
          {({ id }) => (
            <Select
              id={id}
              value={channel}
              onChange={(event) => setChannel(event.target.value as ContactChannel)}
            >
              {CHANNELS.map((item) => (
                <option key={item} value={item} disabled={!patient?.phone && item === 'phone'}>
                  {contactChannelLabel[item]}
                  {!patient?.phone && item === 'phone' ? ' (belum ada nomor)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Apa yang terjadi?" required>
          {() => (
            <RadioGroup<Outcome>
              name="attempt-outcome"
              value={outcome}
              onChange={setOutcome}
              options={[
                {
                  value: 'reached',
                  label: 'Pasien berhasil dihubungi',
                  description: 'Sudah bicara dengan pasien atau anggota keluarga.',
                },
                { value: 'no-answer', label: 'Tidak ada jawaban', description: 'Tidak ada yang merespons.' },
                {
                  value: 'wrong-number',
                  label: 'Nomor salah',
                  description: 'Data kontak perlu diverifikasi ulang.',
                },
                {
                  value: 'moved-away',
                  label: 'Sudah pindah',
                  description: 'Pasien tidak lagi tinggal di alamat ini.',
                },
                {
                  value: 'rescheduled',
                  label: 'Sepakat tanggal baru',
                  description: 'Jadwalkan ulang follow-up secara terpisah setelah mencatat ini.',
                },
              ]}
            />
          )}
        </Field>

        <Field
          label="Catatan"
          error={error}
          optional={outcome === 'reached'}
          required={outcome !== 'reached'}
        >
          {({ id, describedBy, invalid }) => (
            <TextArea
              id={id}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              describedBy={describedBy}
              invalid={invalid}
              rows={3}
              placeholder="mis. Keluarga bilang pasien pergi sampai Jumat; kader akan menyampaikan pesan."
            />
          )}
        </Field>

        <Notice tone="demo" compact>
          Ini hanya mencatat apa yang dilakukan petugas. Prototipe ini tidak melakukan panggilan atau mengirim pesan.
        </Notice>
      </div>
    </Dialog>
  );
}

export function CompleteFollowUpDialog({
  open,
  onClose,
  followUp,
}: {
  open: boolean;
  onClose: () => void;
  followUp: FollowUp;
}) {
  const completeFollowUp = useDataStore((state) => state.completeFollowUp);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (note.trim().length < 5) {
      setError('Catat hasilnya, walau singkat. Catatan ini masuk ke timeline pasien.');
      return;
    }
    try {
      await completeFollowUp(followUp.id, note.trim());
      toast.success(`${followUp.code} selesai.`, 'Hasilnya sudah ditambahkan ke timeline pasien.');
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Follow-up gagal diselesaikan.');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={`Selesaikan ${followUp.code}`}
      description="Tutup tugas ini dan catat hasilnya."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            leadingIcon={<CheckCircle2 className="size-4" />}
            onClick={submit}
          >
            Tandai selesai
          </Button>
        </>
      }
    >
      <Field label="Hasil" error={error} required>
        {({ id, describedBy, invalid }) => (
          <TextArea
            id={id}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            describedBy={describedBy}
            invalid={invalid}
            rows={4}
            placeholder="mis. Datang ke rumah sakit daerah hari Selasa; sampel dahak sudah diambil, hasil masih menunggu."
          />
        )}
      </Field>
    </Dialog>
  );
}

export function UnresolvedFollowUpDialog({
  open,
  onClose,
  followUp,
}: {
  open: boolean;
  onClose: () => void;
  followUp: FollowUp;
}) {
  const markFollowUpUnresolved = useDataStore((state) => state.markFollowUpUnresolved);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (reason.trim().length < 10) {
      setError('Jelaskan apa yang menghambat, cukup rinci agar orang lain bisa melanjutkannya.');
      return;
    }
    try {
      await markFollowUpUnresolved(followUp.id, reason.trim());
      toast.attention(
        `${followUp.code} ditandai belum terselesaikan.`,
        'Tetap terlihat di queue belum terselesaikan dan tidak hilang begitu saja.',
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Follow-up gagal diperbarui.');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={`Tandai ${followUp.code} belum terselesaikan`}
      description="Gunakan ini bila pasien benar-benar tidak bisa dihubungi atau di-follow-up."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            leadingIcon={<CircleSlash className="size-4" />}
            onClick={submit}
          >
            Tandai belum terselesaikan
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Kenapa tugas ini tidak bisa ditutup?" error={error} required>
          {({ id, describedBy, invalid }) => (
            <TextArea
              id={id}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              describedBy={describedBy}
              invalid={invalid}
              rows={4}
              placeholder="mis. Keluarga pindah ke kabupaten lain untuk bekerja; nomor tidak aktif dan alamat baru tidak diketahui."
            />
          )}
        </Field>
        <Notice tone="attention" compact>
          Follow-up yang belum terselesaikan tetap berada di queue-nya sendiri. Tidak ditutup dan
          tidak dihitung sebagai selesai.
        </Notice>
      </div>
    </Dialog>
  );
}
