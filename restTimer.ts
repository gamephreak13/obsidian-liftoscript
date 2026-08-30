/*
 * restTimer.ts
 *
 * An in-memory-only countdown timer for rest periods. It deliberately never calls
 * Vault.modify() or touches the markdown file while ticking, so that real-time sync
 * (LiveSync) or Obsidian Git do not get flooded with per-second file modifications.
 *
 * Callers subscribe for tick updates and for the "zero" event.
 */

export type RestTimerListener = (remainingSeconds: number) => void;

interface ActiveTimer {
  totalSeconds: number;
  remaining: number;
  intervalId?: number;
  tickListeners: Set<RestTimerListener>;
  completeListeners: Set<RestTimerListener>;
}

let active: ActiveTimer | null = null;

export function getActiveRemaining(): number | null {
  return active ? active.remaining : null;
}

export function isRestRunning(): boolean {
  return active != null && active.remaining > 0;
}

export function startRest(
  seconds: number,
  onTick: RestTimerListener,
  onComplete: RestTimerListener
): void {
  if (active) {
    clearInterval(active.intervalId);
  }
  const total = Math.max(0, Math.floor(seconds));
  active = {
    totalSeconds: total,
    remaining: total,
    tickListeners: new Set([onTick]),
    completeListeners: new Set([onComplete]),
  };
  onTick(total);
  if (total <= 0) {
    return;
  }
  active.intervalId = window.setInterval(() => {
    if (!active) {
      return;
    }
    active.remaining -= 1;
    active.tickListeners.forEach((l) => l(active!.remaining));
    if (active.remaining <= 0) {
      clearInterval(active.intervalId);
      const completed = active;
      active = null;
      completed.completeListeners.forEach((l) => l(0));
    }
  }, 1000);
}

export function stopRest(): void {
  if (!active) {
    return;
  }
  clearInterval(active.intervalId);
  active = null;
}
