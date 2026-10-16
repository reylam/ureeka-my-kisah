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
      toast.success('Stored radiographs cleared.', 'Records on the server were not touched.');
      setClearImagesOpen(false);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title="Settings"
        description="Your profile, your facility, and what is stored on this device."
      />

      {/* Profile */}
      <Card>
        <CardHeader icon={<UserCog />} title="Profile" />
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
                      Can sign off reviews
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm" icon={<FlaskConical />}>
                      Cannot sign off reviews
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
                Sign out
              </Button>
            </div>
          ) : null}

          <dl className="divide-y divide-obsidian-100">
            <DetailRow label="Email">{user?.email ?? 'Not signed in'}</DetailRow>
            <DetailRow label="Phone">{user?.phone ?? 'None on file'}</DetailRow>
          </dl>

          <Notice tone="info" compact>
            Profile details come from the staff directory and are managed by an administrator, so
            the fields are read-only here.
          </Notice>
        </CardBody>
      </Card>

      {/* Facility */}
      <Card>
        <CardHeader
          icon={<Building2 />}
          title="Facility"
          description="The facility you are working at."
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
                <DetailRow label="Address">{facility.address}</DetailRow>
                <DetailRow label="Region">
                  {facility.region}, {facility.province}
                </DetailRow>
                <DetailRow label="Phone">{facility.phone}</DetailRow>
                <DetailRow label="Opening hours">{facility.operatingHours}</DetailRow>
                <DetailRow label="On-site services">
                  {facility.services.map((service) => facilityServiceLabel[service]).join(', ')}
                </DetailRow>
                <DetailRow label="TB programme contact">
                  {facility.tbProgrammeContact ?? 'No named contact'}
                </DetailRow>
                <DetailRow label="Entry last checked">
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
          title="Prototype environment"
          description="What is running, and what is not."
        />
        <CardBody className="space-y-4">
          <dl className="divide-y divide-obsidian-100">
            <DetailRow label="Screening output">
              {DEMO_MODEL.name}
              <span className="ml-1.5 font-mono text-xs text-obsidian-400">
                {DEMO_MODEL.version}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-obsidian-500">
                The screening model runs as a separate service. While it is not connected,
                records are saved and reviewed by a clinician without model output.
              </span>
            </DetailRow>
            <DetailRow label="Label set">{DEMO_MODEL.labels.join(', ')}</DetailRow>
            <DetailRow label="Reported performance">
              <span className="text-obsidian-500">
                None. Nothing here has been evaluated, so no accuracy figures are shown anywhere in
                the product.
              </span>
            </DetailRow>
            <DetailRow label="Authentication">
              <span className="text-obsidian-500">
                Handled by Supabase Auth. Every request is checked again by the API and the
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
                toast.info(value ? 'Offline mode simulated.' : 'Offline simulation switched off.');
              }}
              label="Work offline"
              description="Forces the offline behaviour without disconnecting the network."
            />
          </div>

          <Notice tone="info" compact>
            Animations follow your operating system&rsquo;s reduced-motion setting.
          </Notice>
        </CardBody>
      </Card>

      {/* Storage */}
      <Card>
        <CardHeader
          icon={<HardDrive />}
          title="Storage on this device"
          description="Radiographs and records captured offline, held here until they are sent."
          actions={
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<RefreshCw className="size-3.5" />}
              onClick={() => void refreshUsage()}
              loading={usageLoading}
            >
              Recheck
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-obsidian-200 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                <ImageIcon aria-hidden className="size-3" />
                Radiographs (IndexedDB)
              </p>
              <p className="mt-2 text-lg leading-none font-semibold text-obsidian-950 tabular">
                {usageLoading ? 'â€¦' : usage ? formatBytes(usage.bytes) : 'Unavailable'}
              </p>
              <p className="mt-1.5 text-xs text-obsidian-500">
                {usageLoading
                  ? 'Checking'
                  : usage
                    ? `${pluralise(usage.count, 'image')} stored`
                    : 'Could not read the image store'}
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
                {pluralise(syncQueue.length, 'record')} waiting to be sent
              </p>
            </div>
          </div>

          <Notice tone="demo" compact>
            Radiographs are kept out of localStorage and out of the service-worker cache on
            purpose. They stay here only until the record is sent; the server then holds them in
            private storage.
          </Notice>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              leadingIcon={<ImageIcon className="size-4" />}
              onClick={() => setClearImagesOpen(true)}
              disabled={!usage || usage.count === 0 || hasQueuedImages}
            >
              Clear stored radiographs
            </Button>
            {hasQueuedImages ? (
              <p className="self-center text-xs text-obsidian-500">
                Send or discard the queued records first.
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
        title="Clear stored radiographs?"
        description="Images held on this device will be deleted. Records already on the server are not affected."
        confirmLabel="Clear images"
      />
    </div>
  );
}
