import { notifyRestComplete } from "./notify";

/*
 * stretchTimer.ts
 *
 * In-memory countdown sessions for stretch holds. A stretch session is keyed by
 * the note path + exercise line + set index, so when Obsidian re-renders the
 * note (e.g. after a set marker is written back to the file) the card rebuild
 * can re-attach its display callback to the still-running session. This keeps
 * the visible countdown alive across DOM replacement.
 */

export type StretchPhase = "hold" | "rest" | "done";

export interface StretchTick {
  phase: StretchPhase;
  remaining: number;
}

interface StretchSession {
  key: string;
  hold: number;
  rest: number;
  phase: StretchPhase;
  remaining: number;
  message: string;
  listener?: (tick: StretchTick) => void;
}

const sessions = new Map<string, StretchSession>();
let intervalId: number | null = null;

function tickOnce(): void {
  for (const [key, session] of sessions) {
    if (session.phase === "done") {
      continue;
    }
    session.remaining -= 1;
    if (session.remaining <= 0) {
      if (session.phase === "hold" && session.rest > 0) {
        session.phase = "rest";
        session.remaining = session.rest;
      } else {
        session.phase = "done";
        session.remaining = 0;
      }
    }
    session.listener?.({ phase: session.phase, remaining: session.remaining });
    if (session.phase === "done") {
      sessions.delete(key);
      notifyRestComplete(session.message);
    }
  }
  if (sessions.size === 0 && intervalId != null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

function ensureActive(): void {
  if (intervalId == null) {
    intervalId = window.setInterval(tickOnce, 1000);
  }
}

/** Begin (or restart) a countdown for a stretch set and wire a display callback. */
export function startStretchHold(opts: {
  key: string;
  hold: number;
  rest: number;
  message: string;
  onTick: (tick: StretchTick) => void;
}): void {
  const { key, hold, rest, message, onTick } = opts;
  // Only the last hold/rest counter should be active. Clear any existing
  // sessions so multiple sets/exercises cannot tick and notify concurrently.
  // Reset the display of superseded timers to their initial Hold value.
  for (const [k, session] of Array.from(sessions.entries())) {
    sessions.delete(k);
    if (k !== key) {
      session.listener?.({ phase: "hold", remaining: Math.max(0, Math.floor(session.hold)) });
    }
  }
  sessions.set(key, {
    key,
    hold,
    rest,
    phase: "hold",
    remaining: Math.max(0, Math.floor(hold)),
    message,
    listener: onTick,
  });
  onTick({ phase: "hold", remaining: Math.max(0, Math.floor(hold)) });
  ensureActive();
}

/**
 * Re-bind a display callback to a running session (e.g. after the note is
 * re-rendered). Returns true when a session was found and re-attached.
 */
export function attachStretchTimer(
  key: string,
  onTick: (tick: StretchTick) => void
): boolean {
  const session = sessions.get(key);
  if (!session) {
    return false;
  }
  session.listener = onTick;
  onTick({ phase: session.phase, remaining: session.remaining });
  return true;
}

/** Stop and forget a running stretch session (e.g. on uncheck). */
export function stopStretchTimer(key: string): void {
  sessions.delete(key);
  if (sessions.size === 0 && intervalId != null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

/** Whether a session for key is currently active (used to hide cancel button for superseded timers). */
export function hasStretchSession(key: string): boolean {
  return sessions.has(key);
}