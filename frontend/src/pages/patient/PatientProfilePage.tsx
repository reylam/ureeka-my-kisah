import { useState } from 'react';
import { Lock, Pencil, ShieldCheck, UserCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Badge } from '@/components/ui/Badge';
import { Field } from '@/components/forms/Field';
import { Checkbox, TextInput } from '@/components/forms/Inputs';
import { errorMessage } from '@/lib/apiClient';
import { saveOnboardingPersonal, withdrawHealthConsent } from '@/services/onboardingApi';
import { useCurrentAccount } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { formatDate } from '@/utils/date';
import { ROLE_LABEL } from '@/lib/permissions';

/**
 * Patient profile and consent.
 *
 * The part that matters here is the consent block. Health answers can be
 * withdrawn, and withdrawing clears the answers rather than only flipping a
 * flag, because a consent switch that leaves the data sitting there is not
 * consent. It is a preference.
 */
export function PatientProfilePage() {
  const account = useCurrentAccount();
  const [editing, setEditing] = useState(false);

  const [draft, setDraft] = useState(() => ({
    fullName: account?.onboarding.personal?.fullName ?? account?.name ?? '',
    phone: account?.onboarding.personal?.phone ?? '',
  }));

  if (!account) return null;
  const { personal, address, health, consent } = account.onboarding;

  const save = async () => {
    if (draft.fullName.trim().length < 2) {
      toast.error('Isi nama lengkap kamu.');
      return;
    }
    try {
      await saveOnboardingPersonal({
        fullName: draft.fullName.trim(),
        birthDate: personal?.birthDate ?? '',
        phone: draft.phone.trim(),
        sex: personal?.sex ?? null,
      });
      setEditing(false);
      toast.success('Profil diperbarui.');
    } catch (cause) {
      toast.error('Profil tidak bisa diperbarui.', errorMessage(cause));
    }
  };

  // The server clears the answers, not just the consent flag.
  const withdrawHealth = async () => {
    try {
      await withdrawHealthConsent();
      toast.success('Jawaban kesehatan ditarik.', 'Jawaban sudah dihapus dari rekam kamu.');
    } catch (cause) {
      toast.error('Jawaban kamu tidak bisa ditarik.', errorMessage(cause));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profil saya"
        description="Data diri kamu, jawaban kesehatan, dan apa saja yang sudah kamu setujui untuk dibagikan."
      />

      <Card>
        <CardHeader
          title="Tentang kamu"
          icon={<UserCircle />}
          actions={
            editing ? null : (
              <Button
                variant="outline"
                size="sm"
                leadingIcon={<Pencil className="mr-1.5 size-3.5" />}
                onClick={() => setEditing(true)}
              >
                Ubah
              </Button>
            )
          }
        />
        <CardBody>
          {editing ? (
            <div className="space-y-4">
              <Field label="Nama lengkap" required>
                {({ id }) => (
                  <TextInput
                    id={id}
                    value={draft.fullName}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, fullName: event.target.value }))
                    }
                  />
                )}
              </Field>
              <Field label="Nomor telepon">
                {({ id }) => (
                  <TextInput
                    id={id}
                    type="tel"
                    value={draft.phone}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, phone: event.target.value }))
                    }
                  />
                )}
              </Field>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={save}>
                  Simpan perubahan
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <dl className="divide-y divide-obsidian-100">
              <DetailRow label="Nama">{personal?.fullName ?? account.name}</DetailRow>
              <DetailRow label="Email">{account.email}</DetailRow>
              <DetailRow label="Telepon">{personal?.phone || 'Belum diisi'}</DetailRow>
              <DetailRow label="Tanggal lahir">
                {personal?.birthDate ? formatDate(personal.birthDate) : 'Belum diisi'}
              </DetailRow>
              <DetailRow label="Tinggal di">
                {address
                  ? [address.village, address.district, address.province].filter(Boolean).join(', ')
                  : 'Belum diisi'}
              </DetailRow>
              <DetailRow label="Tipe akun">{ROLE_LABEL[account.role]}</DetailRow>
              <DetailRow label="Anggota sejak">{formatDate(account.createdAt)}</DetailRow>
            </dl>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Informasi kesehatan"
          icon={<ShieldCheck />}
          description="Apa yang kamu isi saat mendaftar, dan siapa yang bisa melihatnya."
          actions={
            health?.shared ? (
              <Badge tone="info" size="sm" icon={<ShieldCheck />}>
                Dibagikan ke tim perawatan kamu
              </Badge>
            ) : (
              <Badge tone="inert" size="sm" icon={<Lock />}>
                Tidak dibagikan
              </Badge>
            )
          }
        />
        <CardBody className="space-y-4">
          {health?.shared ? (
            <>
              <dl className="divide-y divide-obsidian-100">
                <DetailRow label="Gejala yang dilaporkan">
                  {health.symptoms.length > 0 ? `${health.symptoms.length} dipilih` : 'Tidak ada'}
                </DetailRow>
                <DetailRow label="Durasi">
                  {health.symptomWeeks ? `Sekitar ${health.symptomWeeks} minggu` : 'Tidak diisi'}
                </DetailRow>
                <DetailRow label="Pengobatan TB sebelumnya">
                  {
                    {
                      never: 'Belum pernah berobat',
                      treated: 'Pernah berobat dan tuntas',
                      ongoing: 'Sedang berobat',
                      'prefer-not-to-say': 'Memilih tidak menjawab',
                    }[health.priorTb]
                  }
                </DetailRow>
              </dl>

              <Notice tone="info" compact>
                Hanya tenaga kesehatan yang ditugaskan merawat kamu yang bisa membuka jawaban ini.
                Pasien lain tidak bisa melihatnya, dan administrator hanya melihat detail akun,
                bukan rekam kesehatan kamu.
              </Notice>

              <Button variant="outline" size="sm" onClick={withdrawHealth}>
                Tarik dan hapus jawaban kesehatan saya
              </Button>
            </>
          ) : (
            <>
              <p className="max-w-prose text-[13px] leading-relaxed text-obsidian-600">
                Kamu belum membagikan detail kesehatan apa pun. Tidak masalah: akun kamu tetap
                berfungsi tanpa itu. Membagikan gejala membantu siapa pun yang membaca rekam kamu,
                karena gejala lebih penting daripada gambar mana pun.
              </p>
              <ButtonLink to="/onboarding" variant="outline" size="sm">
                Tambah detail kesehatan
              </ButtonLink>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Persetujuan" icon={<Lock />} />
        <CardBody className="space-y-3">
          <Checkbox
            label="Nama, kontak, dan alamat saya boleh dipakai untuk mengelola akun dan perawatan saya."
            description="Wajib agar akun bisa berfungsi. Hubungi administrator jika ingin menutup akun."
            checked={consent?.dataUse ?? false}
            onChange={() => undefined}
            disabled
          />
          <Checkbox
            label="Jawaban kesehatan saya boleh dibagikan ke tenaga kesehatan yang ditugaskan merawat saya."
            checked={Boolean(consent?.healthInfo && health?.shared)}
            onChange={(checked) => {
              if (!checked) {
                withdrawHealth();
                return;
              }
              toast.info(
                'Tambahkan detail kesehatan kamu dulu.',
                'Belum ada yang bisa dibagikan sampai kamu menjawab pertanyaan kesehatan.',
              );
            }}
          />
          {consent ? (
            <p className="border-t border-obsidian-100 pt-3 text-[12px] text-obsidian-500">
              Disetujui pada {formatDate(consent.acceptedAt)}.
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
