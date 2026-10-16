import { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import type { ClinicalReview, Screening } from '@/types/domain';
import { Button } from '@/components/ui/Button';
import { Field, Fieldset } from '@/components/forms/Field';
import { RadioGroup, TextArea } from '@/components/forms/Inputs';
import { Notice } from '@/components/ui/Notice';
import { errorMessage } from '@/lib/apiClient';
import { useCurrentUser } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { toast } from '@/stores/toastStore';
import { userRoleLabel } from '@/utils/labels';
import { users } from '@/data/users';
import { formatDateTime } from '@/utils/date';

/**
 * Clinical review sign-off.
 *
 * The screening output is never the end of the workflow. A person has to look
 * at the image and decide. Only roles with `canReview` can submit here; others
 * see why they cannot, rather than a disabled button with no explanation.
 */

type Agreement = ClinicalReview['agreement'];
type Decision = ClinicalReview['decision'];

export function ReviewForm({
  screening,
  onReviewed,
}: {
  screening: Screening;
  onReviewed?: () => void;
}) {
  const user = useCurrentUser();
  const submitReview = useDataStore((state) => state.submitReview);

  const [agreement, setAgreement] = useState<Agreement>('agrees');
  const [decision, setDecision] = useState<Decision>(
    screening.analysis?.outcome === 'flagged-for-review'
      ? 'refer'
      : screening.analysis?.outcome === 'inconclusive'
        ? 'repeat-image'
        : screening.analysis
          ? 'no-action'
          : 'observe',
  );
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* Already reviewed: show the signed-off record instead of the form. */
  if (screening.review) {
    const reviewer = users.find((u) => u.id === screening.review!.reviewerId);
    // Without model output there is nothing to agree with, so the same three
    // stored values read as the reviewer's own conclusion about the image.
    const agreementText: Record<Agreement, string> = screening.analysis
      ? {
          agrees: 'Sesuai dengan output screening',
          disagrees: 'Tidak sesuai dengan output screening',
          'needs-more-data': 'Belum bisa disimpulkan tanpa data tambahan',
        }
      : {
          agrees: 'Gambar sudah ditinjau, tidak ada temuan mengkhawatirkan',
          disagrees: 'Gambar sudah ditinjau, ada temuan mengkhawatirkan',
          'needs-more-data': 'Belum bisa disimpulkan tanpa data tambahan',
        };
    const decisionText: Record<Decision, string> = {
      refer: 'Rujuk untuk pemeriksaan diagnostik',
      'repeat-image': 'Ulangi radiograf',
      observe: 'Observasi dan periksa ulang',
      'no-action': 'Tidak ada tindakan lanjutan',
    };

    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-md border border-complete-300/70 bg-complete-50 px-3.5 py-3">
          <ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-complete-700" />
          <div className="min-w-0 text-[13px]">
            <p className="font-medium text-complete-800">
              Ditinjau oleh {reviewer?.name ?? 'seorang klinisi'}
            </p>
            <p className="mt-0.5 text-obsidian-600">
              {formatDateTime(screening.review.reviewedAt)}
              {reviewer ? ` · ${userRoleLabel[reviewer.role]}` : ''}
            </p>
          </div>
        </div>

        <dl className="divide-y divide-obsidian-100 text-[13px]">
          <div className="grid grid-cols-[8rem_1fr] gap-3 py-2">
            <dt className="text-obsidian-500">Penilaian</dt>
            <dd className="text-obsidian-900">{agreementText[screening.review.agreement]}</dd>
          </div>
          <div className="grid grid-cols-[8rem_1fr] gap-3 py-2">
            <dt className="text-obsidian-500">Keputusan</dt>
            <dd className="text-obsidian-900">{decisionText[screening.review.decision]}</dd>
          </div>
          <div className="grid grid-cols-[8rem_1fr] gap-3 py-2">
            <dt className="text-obsidian-500">Catatan</dt>
            <dd className="leading-relaxed text-obsidian-700">{screening.review.notes}</dd>
          </div>
        </dl>
      </div>
    );
  }

  /* A draft has not been submitted, so there is nothing to sign off yet. */
  if (screening.status === 'draft') {
    return (
      <Notice tone="demo" compact>
        Data ini masih berupa draf. Selesaikan dan kirim dulu sebelum bisa ditinjau.
      </Notice>
    );
  }

  /* Wrong role. */
  if (!user?.canReview) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-md border border-obsidian-200 bg-obsidian-50 px-3.5 py-3">
          <Lock aria-hidden className="mt-px size-4 shrink-0 text-obsidian-400" />
          <div className="min-w-0 text-[13px]">
            <p className="font-medium text-obsidian-900">Menunggu reviewer klinis</p>
            <p className="mt-0.5 leading-relaxed text-obsidian-600">
              Peran Anda ({user ? userRoleLabel[user.role] : 'tidak diketahui'}) bisa mencatat
              screening tetapi tidak bisa mengesahkan review. Perawat atau dokter perlu melihat gambar ini.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (notes.trim().length < 10) {
      setError('Tambahkan catatan singkat tentang pembacaan Anda. Minimal 10 karakter.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await submitReview(screening.id, { agreement, decision, notes: notes.trim() });
      toast.success('Review tercatat.', 'Data screening sudah disahkan.');
      onReviewed?.();
    } catch (cause) {
      // The server re-checks that this person may sign off and that the record is open.
      toast.error('Review gagal dicatat.', errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Fieldset legend="Pembacaan Anda atas gambar">
        <RadioGroup<Agreement>
          name="agreement"
          value={agreement}
          onChange={setAgreement}
          options={[
            {
              value: 'agrees',
              label: screening.analysis ? 'Sesuai dengan output screening' : 'Tidak ada temuan mengkhawatirkan pada gambar ini',
              description: screening.analysis
                ? 'Yang saya lihat sesuai dengan laporan model.'
                : 'Saya sudah melihat gambar dan tidak ada yang perlu dieskalasi.',
            },
            {
              value: 'disagrees',
              label: screening.analysis ? 'Tidak sesuai dengan output screening' : 'Ada temuan mengkhawatirkan pada gambar ini',
              description: screening.analysis
                ? 'Pembacaan saya berbeda. Data harus mengikuti penilaian saya.'
                : 'Saya melihat sesuatu yang perlu di-follow-up.',
            },
            {
              value: 'needs-more-data',
              label: 'Tidak bisa disimpulkan dari gambar ini',
              description: 'Kualitas atau posisi gambar membuat pembacaan tidak andal.',
            },
          ]}
        />
      </Fieldset>

      <Fieldset legend="Langkah selanjutnya" hint="Pilihan ini menentukan status alur kerja data.">
        <RadioGroup<Decision>
          name="decision"
          value={decision}
          onChange={setDecision}
          options={[
            {
              value: 'refer',
              label: 'Rujuk untuk pemeriksaan diagnostik',
              description: 'Eskalasi ke fasilitas yang bisa memastikan atau menyingkirkan TB.',
            },
            {
              value: 'repeat-image',
              label: 'Ulangi radiograf',
              description: 'Minta pasien kembali untuk mendapatkan gambar yang lebih baik.',
            },
            {
              value: 'observe',
              label: 'Observasi dan periksa ulang',
              description: 'Biarkan data tetap terbuka dan jadwalkan pemeriksaan ulang gejala.',
            },
            {
              value: 'no-action',
              label: 'Tidak ada tindakan lanjutan',
              description: 'Tutup data. Pasien disarankan kembali jika gejala berubah.',
            },
          ]}
        />
      </Fieldset>

      <Field label="Catatan review" error={error} required>
        {({ id, describedBy, invalid }) => (
          <TextArea
            id={id}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            describedBy={describedBy}
            invalid={invalid}
            rows={3}
            placeholder="Apa yang Anda lihat, dan alasan Anda mengambil keputusan ini."
          />
        )}
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-obsidian-500">
          Disahkan oleh <span className="font-medium text-obsidian-800">{user.name}</span> ·{' '}
          {userRoleLabel[user.role]}
        </p>
        <Button
          variant="primary"
          loading={saving}
          leadingIcon={<ShieldCheck className="size-4" />}
          onClick={() => void handleSubmit()}
        >
          Catat review
        </Button>
      </div>
    </div>
  );
}
