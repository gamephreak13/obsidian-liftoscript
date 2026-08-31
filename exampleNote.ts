import { App, normalizePath, TFile } from "obsidian";
import { BUTTON_COMMAND_PREFIX } from "./settings";

/*
 * exampleNote.ts
 *
 * P20: on first activation the plugin seeds a Liftosaur-Example.md at the vault
 * root so users immediately see a fully mocked workout, YAML frontmatter, and
 * Meta Bind quick-add buttons. Only created once — an existing note is never
 * overwritten.
 */

/** Path of the seeded example note (vault root). */
export const EXAMPLE_NOTE_PATH = "Liftosaur-Example.md";

/**
 * Sentinel marking the note as plugin-generated so a stale seeded copy is
 * refreshed on load, while a user's own note at the same path is left alone.
 */
export const EXAMPLE_SENTINEL = "liftoscript_example: true";

/** Fully mocked example note demonstrating the plugin's capabilities. */
export const EXAMPLE_NOTE_CONTENT = `---
date: 2026-08-30
type: workout
liftoscript_example: true
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
command (via the [Meta Bind](https://www.metabind.org/) plugin) to append a
fresh line into the active note. Meta Bind invokes the command by its fully
qualified id, so each button's \`command\` is \`obsidian-liftoscript:liftoscript-add-<slug>\`.

\`\`\`meta-bind-button
label: Add Bench Press
style: primary
action:
  type: command
  command: ${BUTTON_COMMAND_PREFIX}:liftoscript-add-bench-press
\`\`\`

\`\`\`meta-bind-button
label: Add Squat
style: primary
action:
  type: command
  command: ${BUTTON_COMMAND_PREFIX}:liftoscript-add-squat
\`\`\`
`;

/**
 * Ensure the example note exists and is current. Creates it on first load;
 * refreshes an existing copy that carries the plugin's sentinel so seed
 * updates (e.g. new button markup) reach the note; never touches a user's own
 * note at the same path.
 */
export async function ensureExampleNote(app: App): Promise<void> {
  const path = normalizePath(EXAMPLE_NOTE_PATH);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    const text = await app.vault.cachedRead(existing);
    if (text.includes(EXAMPLE_SENTINEL)) {
      await app.vault.process(existing, () => EXAMPLE_NOTE_CONTENT);
    }
    return;
  }
  await app.vault.create(path, EXAMPLE_NOTE_CONTENT);
}
