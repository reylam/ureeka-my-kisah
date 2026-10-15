import { create } from 'zustand';
import { createId } from '@/utils/id';

export type ToastTone = 'neutral' | 'success' | 'attention' | 'urgent';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** Optional single action, e.g. "View record". */
  action?: { label: string; onClick: () => void };
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const AUTO_DISMISS_MS = 5200;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (toast) => {
    const id = createId('tst');
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    // Urgent messages stay until dismissed; the rest expire on their own.
    if (toast.tone !== 'urgent') {
      window.setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
    }
    return id;
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Convenience wrapper so components do not need the store shape. */
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'success', title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'neutral', title, description }),
  attention: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'attention', title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'urgent', title, description }),
  custom: (toastInput: Omit<Toast, 'id'>) => useToastStore.getState().push(toastInput),
};
