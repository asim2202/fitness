import { writable } from 'svelte/store';

export interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error' | 'info';
}

export const toasts = writable<Toast[]>([]);

let nextId = 1;

export function showToast(message: string, variant: Toast['variant'] = 'info', ttlMs = 3000) {
  const id = nextId++;
  toasts.update((arr) => [...arr, { id, message, variant }]);
  setTimeout(() => {
    toasts.update((arr) => arr.filter((t) => t.id !== id));
  }, ttlMs);
}
