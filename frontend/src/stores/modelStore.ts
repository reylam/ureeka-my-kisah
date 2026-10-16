import { create } from 'zustand';
import { api } from '@/lib/apiClient';
import { onSessionReset } from '@/lib/sessionReset';

/**
 * Whether the screening model is wired to the server.
 *
 * The notices that sit next to model output say different things depending on
 * this, so they ask the server (`GET /health`) instead of assuming. `null`
 * means "not known yet", and is treated as not connected: the cautious reading.
 */
interface ModelState {
  connected: boolean | null;
  load: () => Promise<void>;
  reset: () => void;
}

export const useModelStore = create<ModelState>()((set) => ({
  connected: null,
  load: async () => {
    try {
      const health = await api.get<{ modelConnected?: boolean }>('/health');
      set({ connected: health.modelConnected === true });
    } catch {
      set({ connected: false });
    }
  },
  reset: () => set({ connected: null }),
}));

onSessionReset(() => useModelStore.getState().reset());

export const useModelConnected = (): boolean => useModelStore((state) => state.connected === true);
