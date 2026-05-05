import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { showToast } from './toast';

export interface SetPayload {
  sessionId: number;
  exerciseTemplateId: number;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  feltEasy: boolean;
  clientId: string;
}

interface QueueEntry {
  payload: SetPayload;
  attempts: number;
}

const STORAGE_KEY = 'fitness:set-queue';

export const queueSize = writable(0);

function loadQueue(): QueueEntry[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueueEntry[];
  } catch {
    return [];
  }
}

function saveQueue(q: QueueEntry[]) {
  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
  queueSize.set(q.length);
}

let inFlight = false;

export function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'cid-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

export async function enqueueSet(payload: SetPayload): Promise<void> {
  const queue = loadQueue();
  queue.push({ payload, attempts: 0 });
  saveQueue(queue);
  await drain();
}

async function postOne(entry: QueueEntry): Promise<boolean> {
  try {
    const res = await fetch('/api/sets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entry.payload)
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function drain(): Promise<void> {
  if (!browser || inFlight) return;
  inFlight = true;
  try {
    let queue = loadQueue();
    while (queue.length > 0) {
      const head = queue[0];
      const ok = await postOne(head);
      if (ok) {
        queue.shift();
        saveQueue(queue);
      } else {
        head.attempts += 1;
        saveQueue(queue);
        const backoff = Math.min(30_000, 500 * 2 ** Math.min(head.attempts, 6));
        if (head.attempts === 1) {
          showToast('Network glitch — retrying…', 'info');
        }
        if (head.attempts >= 8) {
          showToast(`Set still queued after ${head.attempts} tries`, 'error', 5000);
          break;
        }
        await new Promise((r) => setTimeout(r, backoff));
        queue = loadQueue();
      }
    }
  } finally {
    inFlight = false;
  }
}

export function initSyncQueue() {
  if (!browser) return;
  queueSize.set(loadQueue().length);
  window.addEventListener('online', () => {
    void drain();
  });
  // Drain on startup
  void drain();
}
