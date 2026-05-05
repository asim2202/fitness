import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

interface TimerState {
  endsAt: number | null;
  durationMs: number;
  exerciseName: string | null;
}

const initial: TimerState = { endsAt: null, durationMs: 0, exerciseName: null };
const state = writable<TimerState>(initial);

const tick = writable(0);
let tickInterval: ReturnType<typeof setInterval> | null = null;

function ensureTicking() {
  if (!browser || tickInterval) return;
  tickInterval = setInterval(() => tick.update((n) => n + 1), 250);
}

function stopTicking() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

export const remainingMs = derived([state, tick], ([$s]) => {
  if ($s.endsAt == null) return 0;
  return Math.max(0, $s.endsAt - Date.now());
});

export const isRunning = derived(remainingMs, ($r) => $r > 0);

export const timerState = { subscribe: state.subscribe };

export function startRest(seconds: number, exerciseName: string) {
  if (!browser) return;
  ensureTicking();
  state.set({
    endsAt: Date.now() + seconds * 1000,
    durationMs: seconds * 1000,
    exerciseName
  });
  scheduleAlarm(seconds * 1000);
}

export function skipRest() {
  state.set(initial);
  stopTicking();
  cancelAlarm();
}

let alarmTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleAlarm(ms: number) {
  cancelAlarm();
  alarmTimeout = setTimeout(() => {
    alarm();
    state.update((s) => (get(remainingMs) <= 0 ? initial : s));
    if (get(remainingMs) <= 0) stopTicking();
  }, ms);
}

function cancelAlarm() {
  if (alarmTimeout) {
    clearTimeout(alarmTimeout);
    alarmTimeout = null;
  }
}

function beep(ctx: AudioContext, freq: number, startAt: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.4, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

function alarm() {
  if (!browser) return;
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const t = ctx.currentTime;
      beep(ctx, 880, t, 0.15);
      beep(ctx, 880, t + 0.2, 0.15);
      beep(ctx, 1320, t + 0.4, 0.3);
    }
  } catch {
    /* sound is best-effort */
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([200, 100, 200, 100, 400]);
  }
}
