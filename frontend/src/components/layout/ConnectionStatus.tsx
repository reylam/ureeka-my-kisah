import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudOff, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useConnectionStore } from '@/stores/connectionStore';
import { useDataStore } from '@/stores/dataStore';
import { formatRelative } from '@/utils/date';
import { pluralise } from '@/utils/format';
import { Dialog } from '@/components/ui/Dialog';
import { Toggle } from '@/components/forms/Inputs';
import { Notice } from '@/components/ui/Notice';
import { Button } from '@/components/ui/Button';

/**
 * Connection indicator for the top bar.
 *
 * Distinguishes a genuine browser-reported disconnection from the demo
 * simulation switch, because telling someone they are offline when they are not
 * (or the reverse) undermines the whole offline story.
 */
export function ConnectionStatus() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const online = useConnectionStore((state) => state.online);
  const simulatedOffline = useConnectionStore((state) => state.simulatedOffline);
  const setSimulatedOffline = useConnectionStore((state) => state.setSimulatedOffline);
  const changedAt = useConnectionStore((state) => state.changedAt);

  const lastSyncAt = useDataStore((state) => state.lastSyncAt);
  const queued = useDataStore(
    (state) => state.syncQueue.filter((item) => item.state !== 'synced').length,
  );

  const connected = online && !simulatedOffline;
  const label = !online ? 'Offline' : simulatedOffline ? 'Offline (simulated)' : 'Online';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Connection status: ${label}. Open connection details.`}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors',
          connected
            ? 'border-obsidian-200 bg-white text-obsidian-600 hover:bg-obsidian-50'
            : 'border-attention-300 bg-attention-50 text-attention-800 hover:bg-attention-100',
        )}
      >
        {connected ? (
          <Wifi aria-hidden className="size-3.5 text-complete-700" />
        ) : (
          <WifiOff aria-hidden className="size-3.5" />
        )}
        <span className="hidden sm:inline">{label}</span>
        {queued > 0 ? (
          <span className="inline-flex items-center gap-1 border-l border-current/20 pl-1.5 tabular">
            <CloudOff aria-hidden className="size-3" />
            {queued}
          </span>
        ) : null}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Connection and synchronisation"
        description="What is stored on this device, and what a sync would actually do."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setOpen(false);
                navigate('/offline');
              }}
            >
              Open offline queue
            </Button>
          </>
        }
      >
        <dl className="divide-y divide-obsidian-100 text-[13px]">
          <Row label="Browser reports">
            <span className={online ? 'text-complete-800' : 'text-attention-800'}>
              {online ? 'Connected' : 'No connection'}
            </span>
            <span className="text-obsidian-400"> · changed {formatRelative(changedAt)}</span>
          </Row>
          <Row label="Records waiting">
            {queued === 0 ? 'Nothing queued' : pluralise(queued, 'record')}
          </Row>
          <Row label="Last demo sync">
            {lastSyncAt ? formatRelative(lastSyncAt) : 'Never run in this session'}
          </Row>
        </dl>

        <div className="mt-4 rounded-md border border-obsidian-200 bg-obsidian-50 px-3.5 py-3">
          <Toggle
            tone="attention"
            checked={simulatedOffline}
            onChange={setSimulatedOffline}
            label="Simulate being offline"
            description="A demo control. Forces the app into its offline behaviour without disconnecting the network, so the queue and draft flow can be shown."
          />
        </div>

        <Notice tone="demo" className="mt-4">
          <p>
            Screening records and radiographs you create are written to this browser&rsquo;s own
            storage on this device. Nothing is uploaded anywhere. There is no server in this
            prototype, so &ldquo;sync&rdquo; only moves records between local states.
          </p>
          <p className="mt-2">
            Browser storage is not a substitute for a secured backend. Anyone with access to this
            device profile can read it.
          </p>
        </Notice>
      </Dialog>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-2">
      <dt className="text-obsidian-500">{label}</dt>
      <dd className="text-obsidian-900">{children}</dd>
    </div>
  );
}
