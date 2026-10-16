import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Database,
  FlaskConical,
  HardDrive,
  Image as ImageIcon,
  LogOut,
  RefreshCw,
  UserCog,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Notice } from '@/components/ui/Notice';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Toggle } from '@/components/forms/Inputs';
import { FacilityInfoBadge } from '@/components/ui/StatusBadge';
import { useAuthStore, useCurrentUser } from '@/stores/authStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useDataStore } from '@/stores/dataStore';
import { toast } from '@/stores/toastStore';
import { clearImages, getStorageUsage } from '@/services/imageStore';
import { unregisterServiceWorker } from '@/utils/registerServiceWorker';
import { facilities, OPERATING_FACILITY_ID } from '@/data/facilities';
import { DEMO_MODEL } from '@/data/model';
import { facilityServiceLabel, facilityTypeLabel, userRoleLabel } from '@/utils/labels';
import { formatBytes, pluralise } from '@/utils/format';
import { formatDate } from '@/utils/date';

/**
 * Settings.
 *
 * Only contains controls that genuinely do something. There is no remote
 * profile to update and no appearance engine to configure, so rather than
 * shipping switches that write to nothing, this page explains the environment
 * and offers the two actions that have real effects: clearing stored images and
 * resetting the demo dataset.
 */
export function SettingsPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const signOut = useAuthStore((state) => state.signOut);

  const simulatedOffline = useConnectionStore((state) => state.simulatedOffline);
  const setSimulatedOffline = useConnectionStore((state) => state.setSimulatedOffline);

  const syncQueue = useDataStore((state) => state.syncQueue);

  const [usage, setUsage] = useState<{ count: number; bytes: number } | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [clearImagesOpen, setClearImagesOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const refreshUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      setUsage(await getStorageUsage());
    } catch {
      setUsage(null);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  const facility = facilities.find((item) => item.id === OPERATING_FACILITY_ID);

  /** Rough size of the offline outbox held in localStorage (records waiting to be sent). */
  const metadataBytes = (() => {
    try {
      let bytes = 0;
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key?.startsWith('pulmo.outbox.v1')) {
          bytes += new Blob([window.localStorage.getItem(key) ?? '']).size;
        }
      }
      return bytes;
    } catch {
      return 0;
    }
  })();

  // Images that are still waiting to be uploaded must not be cleared, or the
  // queued record would lose its radiograph before it reaches the server.
  const hasQueuedImages = syncQueue.length > 0;

  const handleClearImages = async () => {
    setWorking(true);
    try {
      await clearImages();
      await unregisterServiceWorker();
      await refreshUsage();
      toast.success('Radiograf tersimpan sudah dihapus.', 'Data di server tidak ikut terhapus.');
      setClearImagesOpen(false);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title="Pengaturan"
        description="Profil, fasilitas, dan data yang tersimpan di perangkat ini."
      />

      {/* Profile */}
      <Card>
        <CardHeader icon={<UserCog />} title="Profil" />
        <CardBody className="space-y-4">
          {user ? (
            <div className="flex items-start gap-3">
              <Avatar name={user.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-obsidian-950">{user.name}</p>
                <p className="mt-0.5 text-[13px] text-obsidian-500">{userRoleLabel[user.role]}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {user.canReview ? (
                    <Badge tone="complete" size="sm" icon={<FlaskConical />}>
                      Bisa mengesahkan review
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm" icon={<FlaskConical />}>
                      Tidak bisa mengesahkan review
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                leadingIcon={<LogOut className="size-4" />}
                onClick={() => {
                  signOut();
                  navigate('/login', { replace: true });
                }}
              >
                Keluar
              </Button>
            </div>
          ) : null}

          <dl className="divide-y divide-obsidian-100">
            <DetailRow label="Email">{user?.email ?? 'Belum masuk'}</DetailRow>
            <DetailRow label="Telepon">{user?.phone ?? 'Belum ada data'}</DetailRow>
          </dl>

          <Notice tone="info" compact>
            Detail profil berasal dari direktori staf dan dikelola oleh administrator, jadi kolom
            di sini hanya bisa dibaca.
          </Notice>
        </CardBody>
      </Card>

      {/* Facility */}
      <Card>
        <CardHeader
          icon={<Building2 />}
          title="Fasilitas"
          description="Fasilitas tempat kamu bertugas."
        />
        <CardBody>
          {facility ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-obsidian-950">{facility.name}</p>
                <Badge tone="neutral" size="sm" icon={<Building2 />}>
                  {facilityTypeLabel[facility.type]}
                </Badge>
                <FacilityInfoBadge status={facility.infoStatus} size="sm" />
              </div>
              <dl className="mt-3 divide-y divide-obsidian-100">
                <DetailRow label="Alamat">{facility.address}</DetailRow>
                <DetailRow label="Wilayah">
                  {facility.region}, {facility.province}
                </DetailRow>
                <DetailRow label="Telepon">{facility.phone}</DetailRow>
                <DetailRow label="Jam operasional">{facility.operatingHours}</DetailRow>
                <DetailRow label="Layanan di lokasi">
                  {facility.services.map((service) => facilityServiceLabel[service]).join(', ')}
                </DetailRow>
                <DetailRow label="Kontak program TB">
                  {facility.tbProgrammeContact ?? 'Belum ada kontak'}
                </DetailRow>
                <DetailRow label="Terakhir diperiksa">
                  {formatDate(facility.infoUpdatedAt)}
                </DetailRow>
              </dl>
            </>
          ) : null}
        </CardBody>
      </Card>

      {/* Environment */}
      <Card>
        <CardHeader
          icon={<FlaskConical />}
          title="Lingkungan prototipe"
          description="Apa saja yang berjalan, dan apa yang belum."
        />
        <CardBody className="space-y-4">
          <dl className="divide-y divide-obsidian-100">
            <DetailRow label="Output screening">
              {DEMO_MODEL.name}
              <span className="ml-1.5 font-mono text-xs text-obsidian-400">
                {DEMO_MODEL.version}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-obsidian-500">
                Model screening berjalan sebagai service terpisah. Selama belum terhubung,
                data tetap disimpan dan ditinjau klinisi tanpa output model.
              </span>
            </DetailRow>
            <DetailRow label="Label set">{DEMO_MODEL.labels.join(', ')}</DetailRow>
            <DetailRow label="Performa yang dilaporkan">
              <span className="text-obsidian-500">
                Tidak ada. Belum ada yang dievaluasi, jadi angka akurasi tidak ditampilkan di
                bagian mana pun dalam produk ini.
              </span>
            </DetailRow>
            <DetailRow label="Autentikasi">
              <span className="text-obsidian-500">
                Ditangani oleh Supabase Auth. Setiap request diperiksa ulang oleh API dan
                database.
              </span>
            </DetailRow>
          </dl>

          <div className="rounded-md border border-obsidian-200 bg-obsidian-50 px-3.5 py-3">
            <Toggle
              tone="attention"
              checked={simulatedOffline}
              onChange={(value) => {
                setSimulatedOffline(value);
                toast.info(value ? 'Mode offline disimulasikan.' : 'Simulasi offline dimatikan.');
              }}
              label="Bekerja offline"
              description="Memaksa perilaku offline tanpa perlu memutus koneksi jaringan."
            />
          </div>

          <Notice tone="info" compact>
            Animasi mengikuti pengaturan reduced-motion di sistem operasi kamu.
          </Notice>
        </CardBody>
      </Card>

      {/* Storage */}
      <Card>
        <CardHeader
          icon={<HardDrive />}
          title="Penyimpanan di perangkat ini"
          description="Radiograf dan data yang diambil saat offline, disimpan di sini sampai terkirim."
          actions={
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<RefreshCw className="size-3.5" />}
              onClick={() => void refreshUsage()}
              loading={usageLoading}
            >
              Cek ulang
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-obsidian-200 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                <ImageIcon aria-hidden className="size-3" />
                Radiograf (IndexedDB)
              </p>
              <p className="mt-2 text-lg leading-none font-semibold text-obsidian-950 tabular">
                {usageLoading ? 'â€¦' : usage ? formatBytes(usage.bytes) : 'Tidak tersedia'}
              </p>
              <p className="mt-1.5 text-xs text-obsidian-500">
                {usageLoading
                  ? 'Memeriksa'
                  : usage
                    ? `${pluralise(usage.count, 'gambar', 'gambar')} tersimpan`
                    : 'Tidak bisa membaca penyimpanan gambar'}
              </p>
            </div>

            <div className="rounded-md border border-obsidian-200 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                <Database aria-hidden className="size-3" />
                Offline outbox (localStorage)
              </p>
              <p className="mt-2 text-lg leading-none font-semibold text-obsidian-950 tabular">
                {formatBytes(metadataBytes)}
              </p>
              <p className="mt-1.5 text-xs text-obsidian-500">
                {pluralise(syncQueue.length, 'data', 'data')} menunggu dikirim
              </p>
            </div>
          </div>

          <Notice tone="demo" compact>
            Radiograf sengaja tidak disimpan di localStorage maupun cache service worker.
            Radiograf hanya ada di sini sampai datanya terkirim; setelah itu server menyimpannya
            di penyimpanan privat.
          </Notice>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              leadingIcon={<ImageIcon className="size-4" />}
              onClick={() => setClearImagesOpen(true)}
              disabled={!usage || usage.count === 0 || hasQueuedImages}
            >
              Hapus radiograf tersimpan
            </Button>
            {hasQueuedImages ? (
              <p className="self-center text-xs text-obsidian-500">
                Kirim atau buang dulu data yang ada di queue.
              </p>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={clearImagesOpen}
        onClose={() => setClearImagesOpen(false)}
        onConfirm={() => void handleClearImages()}
        tone="danger"
        loading={working}
        title="Hapus radiograf tersimpan?"
        description="Gambar yang tersimpan di perangkat ini akan dihapus. Data yang sudah ada di server tidak terpengaruh."
        confirmLabel="Hapus gambar"
      />
    </div>
  );
}
