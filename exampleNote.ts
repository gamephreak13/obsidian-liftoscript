import { App, normalizePath, TFile } from "obsidian";

/*
 * exampleNote.ts
 *
 * P20: on first activation the plugin seeds a Liftosaur-Example.md at the vault
 * root so users immediately see a fully mocked workout, YAML frontmatter, and
 * Buttons-plugin quick-add buttons. Only created once — an existing note is
 * never overwritten.
 */

/** Path of the seeded example note (vault root). */
export const EXAMPLE_NOTE_PATH = "Liftosaur-Example.md";

/** Fully mocked example note demonstrating the plugin's capabilities. */
export const EXAMPLE_NOTE_CONTENT = `---
date: 2026-08-30
type: workout
total_volume: 4500
total_volume_unit: lb
completed_sets: 6
total_sets: 11
total_reps: 30
exercises_completed: 2
session_duration: 0:00
session_duration_seconds: 0
last_updated: 2026-08-30T00:00:00.000Z
---

# Liftosaur Example Workout

Welcome! This note shows what the **Liftoscript** plugin does. Tick a checkbox
to persist it to the file, hit **Start rest** on a strength set for a countdown,
and watch stretch holds count down automatically. Then run **Update workout
metrics** and **Generate Next Workout** from the command palette.

## Strength

\`\`\`liftoscript
[x] [x] [ ] [ ] [x] Bench Press / 5x100lb, 5x100lb, 5x100lb, 5x100lb, 5x100lb, rest: 90, progress: lp(5lb, 1, 0)
[x] [x] [x] Squat / 5x200lb, 5x200lb, 5x200lb, rest: 120, progress: lp(5lb, 1, 0)
[ ] [ ] [ ] Deadlift / 3x225lb, 3x225lb, 3x225lb, rest: 150
\`\`\`

## Stretch

\`\`\`liftoscript
[ ] [ ] [ ] Hamstring Stretch / 3x60s
[ ] [ ] Standing Quad Stretch / 2x45s|30s
\`\`\`

## Quick add

Tapping a button below runs the matching **Liftoscript: Add <exercise>**
command to append a fresh line into the active note.

\`\`\`button
name Add Bench Press
type command
action liftoscript-add-bench-press
\`\`\`

\`\`\`button
name Add Squat
type command
action liftoscript-add-squat
\`\`\`
`;

/**
 * Create the example note on first activation if it does not already exist.
 * Never overwrites an existing note at the same path.
 */
export async function ensureExampleNote(app: App): Promise<void> {
  const path = normalizePath(EXAMPLE_NOTE_PATH);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    return;
  }
  await app.vault.create(path, EXAMPLE_NOTE_CONTENT);
}
