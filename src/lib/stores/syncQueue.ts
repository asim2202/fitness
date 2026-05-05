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
  enqueuedAt: number; // ms epoch — used for max-age cap
}

const STORAGE_KEY = 'fitness:set-queue';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days; older entries get dropped on load

export const queueSize = writable(0);
export const queueEntries = writable<QueueEntry[]>([]);

function loadQueue(): QueueEntry[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<QueueEntry | (Omit<QueueEntry, 'enqueuedAt'>)>;
    const now = Date.now();
    const cleaned: QueueEntry[] = [];
    for (const e of parsed) {
      const enqueuedAt = 'enqueuedAt' in e && typeof e.enqueuedAt === 'number' ? e.enqueuedAt : now;
      if (now - enqueuedAt > MAX_AGE_MS) continue; // drop stale
      cleaned.push({ payload: e.payload, attempts: e.attempts, enqueuedAt });
    }
    if (cleaned.length !== parsed.length) {
      // Stale entries got pruned — persist the cleanup so it doesn't repeat.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

function saveQueue(q: QueueEntry[]) {
  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
  queueSize.set(q.length);
  queueEntries.set(q);
}

let inFlight = false;

export function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'cid-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

export async function enqueueSet(payload: SetPayload): Promise<void> {
  const queue = loadQueue();
  queue.push({ payload, attempts: 0, enqueuedAt: Date.now() });
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

/** Drop a single entry by clientId — for the manual UI when a queued
 *  request will never succeed (stale session, deleted exercise, etc.). */
export function discardQueued(clientId: string): void {
  const queue = loadQueue().filter((e) => e.payload.clientId !== clientId);
  saveQueue(queue);
}

/** Reset all attempt counters and try again — for the "Replay" button. */
export async function replayQueue(): Promise<void> {
  const queue = loadQueue().map((e) => ({ ...e, attempts: 0 }));
  saveQueue(queue);
  await drain();
}

export function initSyncQueue() {
  if (!browser) return;
  const initial = loadQueue();
  queueSize.set(initial.length);
  queueEntries.set(initial);
  window.addEventListener('online', () => {
    void drain();
  });
  // Drain on startup
  void drain();
}
