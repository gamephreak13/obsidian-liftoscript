# Liftoscript for Obsidian

An [Obsidian](https://obsidian.md) plugin that integrates **Liftoscript** — the scripting language from [Liftosaur](https://www.liftosaur.com/) — directly into your notes. It renders workout code blocks as interactive, tappable checklists with rest timers, records your session metrics, and auto-generates your next workout with progressive overload applied.

> **Status:** This is the syntax/documentation as implemented. Examples below are the live format used by the plugin.

---

## Installation

1. Build the plugin: `npm install && npm run build` (produces `main.js`, `manifest.json`, `styles.css`).
2. Copy those **three files** into your vault's plugin folder:

   ```
   <YourVault>/.obsidian/plugins/obsidian-liftoscript/
   ```

3. In Obsidian, open **Settings → Community plugins** (disable Safe mode if prompted), click **Reload plugins**, then enable **Liftoscript**.
4. After any rebuild, fully **restart Obsidian** (or toggle the plugin off/on) — `main.js` only loads at startup.

---

## What's Included

| Feature | Where |
| --- | --- |
| ````liftoscript```` code blocks rendered as interactive checklists | `liftoscriptRender.ts` |
| In-memory rest countdown timer (never rewrites the file mid-tick) | `restTimer.ts` |
| Rest-complete notification (Notice + embedded audio chime) | `notify.ts` |
| Checkboxes persisted back into the raw markdown | `setCompletion.ts` |
| Exercise autocomplete in the editor | `exerciseDb.ts` |
| Session summarization (volume, sets, duration) | `summary.ts` |
| YAML frontmatter metric injection | `frontmatter.ts` |
| `lp()` progressive overload | `progression.ts` / `parser.ts` |
| "Generate Next Workout" command + backlink | `nextWorkout.ts` / `main.ts` |

---

## The Exercise Line Syntax

Each exercise lives on its own line **inside** a ````liftoscript```` code block.

```
[ ] [ ] [ ] Bench Press / 5x100lb, 5x100lb, 5x100lb, rest: 90, progress: lp(5lb, 1, 0)
```

Breaking that down:

| Part | Meaning |
| --- | --- |
| `[ ] [ ] [ ]` | One completion marker **per set**, read left-to-right. `[ ]` = not done, `[x]` = done. |
| `Bench Press` | Exercise name (before the `/`). |
| `/` | Separator between the name and the set spec. |
| `5x100lb` | **One set** of **5 reps @ 100 lb**. The format is `reps x weight`. |
| `,` (comma) | Separates multiple sets on the same line. |
| `rest: 90` | Rest period in seconds (drives the countdown timer). |
| `progress: lp(5lb, 1, 0)` | Progressive-overload rule (see below). |

### Rules & conventions

- **One `NxW` token = one set.** Three sets are written as three comma-separated tokens, and you need exactly one `[ ]`/`[x]` marker per set.
- **Weight units** are `lb` or `kg`: `5x100lb`, `8x42.5kg`.
- **Markers come first**, before the exercise name. When you tick a checkbox in the rendered view, the corresponding `[ ]` becomes `[x]` in the source (and vice-versa).
- The info string on the fence matters — only blocks fenced with exactly ````liftoscript```` are intercepted:

````markdown
```liftoscript
[x] [ ] [ ] Squat / 5x200lb, 5x200lb, 5x200lb, rest: 120
```
````

---

## In the Editor (Reading View)

Open a note containing a ````liftoscript```` block in **Reading** view. Each exercise renders as a card:

- **One checkbox per set** — ticking it checks off the set and writes `[x]` back into the note's source.
- **"Start rest" button** — begins an in-memory countdown shown next to it. When it hits `0:00` you get an Obsidian **Notice** plus a **short alert chime**.
- Ticking **every** set of an exercise marks it complete (used for progression & metrics).

> The timer runs **only in memory** — it never rewrites the file every second — so it won't flood real-time sync (LiveSync) or Obsidian Git with changes.

---

## Autocomplete

While editing a note, type an exercise name after a `/` or list marker (`-`, `*`, `+`), or at the start of a line. A dropdown of **211 built-in exercise names** appears; pick one to insert it.

---

## "Update Workout Metrics" command

**Command Palette → Liftoscript: Update workout metrics in frontmatter**

Runs on the active note: scans its completed ````liftoscript```` blocks and writes a set of **Dataview-friendly** keys into the note's YAML frontmatter:

```yaml
total_volume: 4500
total_volume_unit: lb
completed_sets: 7
total_sets: 9
total_reps: 35
exercises_completed: 1
session_duration: 16:10
session_duration_seconds: 970
last_updated: 2026-08-30T21:49:03.363Z
```

- `total_volume` = sum of (weight × reps) over **completed** sets only.
- `session_duration` = an **estimate**: for each completed set we add the exercise's `rest` seconds plus ~40 s of work time.
- Numbers are rounded; units default to `lb` if a block has no unit.

These keys are queryable directly from the **Dataview** plugin, e.g.:

```dataview
TABLE total_volume, completed_sets, session_duration
FROM "Workouts"
```

---

## "Generate Next Workout" command

**Command Palette → Liftoscript: Generate Next Workout**

Creates a **new markdown file** in the same folder as the active note and opens it. It:

1. Reads the active note's ````liftoscript```` blocks.
2. For each line with a `progress: lp(...)` tag, applies progressive overload (see below).
3. Resets all set markers to `[ ]` (fresh workout).
4. Adds **baseline YAML** with today's date and zeroed metrics.
5. Adds a **backlink** to the previous workout note (`previous_workout`) so you have a clickable history chain.

Example generated file:

```markdown
---
date: 2026-08-30
total_volume: 0
total_volume_unit: lb
completed_sets: 0
exercises_completed: 0
session_duration: 0:00
session_duration_seconds: 0
previous_workout: [[Workout-2026-08-29]]
---

# Workout

```liftoscript
[ ] [ ] [ ] [ ] [ ] Bench Press / 5x105lb, 5x105lb, 5x105lb, 5x105lb, 5x105lb, rest: 90, progress: lp(5lb, 1, 0)
[ ] [ ] [ ] [ ] Deadlift / 5x200lb, 5x200lb, 5x200lb, 5x200lb, rest: 120
```
```

> New files are named `<PreviousBaseName>-<YYYY-MM-DD>.md` (a `-2`, `-3` suffix is added if the name already exists).

---

## Progressive Overload: `lp()`

Attach `progress: lp(...)` to an exercise line to auto-increase the weight next session.

```
progress: lp(increment, successes, counter, decrement, failures, failureCounter)
```

| Arg | Meaning | Default |
| --- | --- | --- |
| `increment` | How much to add when the goal is met. Can be a weight (`5lb`, `2.5kg`) or a percent (`2.5%`). | **required** |
| `successes` | Consecutive successful sessions required before bumping. | `1` |
| `counter` | Running success counter (plugin maintains it for you). | `0` |
| `decrement` | How much to reduce on repeated failure (`lb`/`kg`/`%`). | none |
| `failures` | Consecutive failed sessions before a decrement. | none |
| `failureCounter` | Running failure counter (plugin maintains it). | `0` |

### When is a session "successful"?

An exercise is considered successful when **all of its sets are completed**. So:

```markdown
[x] [x] [x] [x] [x] Bench Press / 5x100lb, 5x100lb, 5x100lb, 5x100lb, 5x100lb, rest: 90, progress: lp(5lb, 1, 0)
```

- **All 5 sets done** → next session uses **`5x105lb`** (100 + 5 increment).
- **Not all sets done** (e.g. only 3 of 5) → weight stays **`5x100lb`**, and each set keeps its own original weight (so `5x100lb, 5x100lb, 5x95lb, 5x95lb, 5x95lb` stays varied).

The plugin rewrites the `lp()` so its counter reflects the real history (e.g. `lp(5lb, 1, 1)` after a partial session) and resets all markers to `[ ]`.

---

## Full Example

A whole workout note start to finish:

````markdown
---
date: 2026-08-30
type: workout
---

# Push Day

```liftoscript
[x] [x] [x] [x] [x] Bench Press / 5x100lb, 5x100lb, 5x100lb, 5x100lb, 5x100lb, rest: 90, progress: lp(5lb, 1, 0)
[x] [x] [x] OHP / 8x42.5kg, 8x42.5kg, 8x42.5kg, rest: 120, progress: lp(2.5kg, 2, 0)
[x] [x] [ ] [x] [ ] Dips / 10x0lb, 10x0lb, 10x0lb, 10x0lb, 10x0lb, rest: 60
```

After this session:

1. Run **Update workout metrics** to fill the frontmatter with `total_volume`, `completed_sets`, `session_duration`, etc.
2. Run **Generate Next Workout** — the new note will show Bench at `5x105lb`, OHP still at `8x42.5kg` (needs 2 successful sessions), and all markers reset to `[ ]`.
````

---

## Development

```bash
npm install        # first time
npm run dev        # watch-build (esbuild, non-minified)
npm run build      # production build -> main.js
```

- `main.ts` — plugin entry point (registers commands, suggest, post-processor).
- `parser.ts` — standalone port of Liftoscript's evaluator + weight model + linear progression.
- Build output: `main.js`, `manifest.json`, `styles.css`.

**No external runtime dependencies** — the plugin only uses Obsidian's standard APIs, and the notification chime is embedded as a Base64 data URI so it's fully self-contained.
