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
| Stretch exercises: timed sets + auto countdown (no weight/progression) | `parser.ts` / `liftoscriptRender.ts` |
| Bodyweight sets (`5xbw`, `5xbw+25lb`, `5xbw-10kg`) + volume using a default body weight | `parser.ts` / `summary.ts` / `settings.ts` |
| Free Exercise DB info modal (equipment, muscles, instructions, images) | `exerciseInfoModal.ts` |
| Edit a rendered card's line (correct reps/weight of a set) | `editLineModal.ts` / `setCompletion.ts` |
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

### Bodyweight exercises

Use `bw` in place of a weight to log an exercise done against your body weight. An
optional `+`/`-` load lets you note added (weighted) or subtracted (assisted) load:

| Token | Meaning |
| --- | --- |
| `5xbw` | 5 reps at body weight |
| `5xbw+25lb` | 5 reps body weight **+25 lb** (weighted / dip belt / vest) |
| `5xbw-10kg` | 5 reps body weight **−10 kg** (assisted / machine counterweight) |

```liftoscript
[ ] [ ] [ ] Pull-Up / 5xbw, 5xbw+25lb, 5xbw-10kg
[ ] [ ] [ ] Push-Up / 10xbw, rest: 60
```

These render as `5 reps @ BW`, `5 reps @ BW +25lb`, and `5 reps @ BW -10kg` on the card.

Bodyweight volume uses your **Default body weight** setting
(Settings → Liftoscript → Default body weight) plus the added load:
`total_volume += (body_weight + added_weight) × reps`. For example, with a default
body weight of `160lb`, `5xbw+25lb` contributes `(160 + 25) × 5 = 925 lb`.

---

## In the Editor (Reading View)

Open a note containing a ````liftoscript```` block in **Reading** view. Each exercise renders as a card:

- **One checkbox per set** — ticking it checks off the set and writes `[x]` back into the note's source.
- **"Start rest" button** — begins an in-memory countdown shown next to it. When it hits `0:00` you get an Obsidian **Notice** plus a **short alert chime**.
- Ticking **every** set of an exercise marks it complete (used for progression & metrics).
- **ℹ️ info button** (top-right of the card header) — when an exercise matches the active **Free Exercise DB**, a small info button appears. Tapping it opens a modal with the exercise's equipment, primary/secondary muscles, step-by-step instructions, an image carousel, and a link to the source on GitHub.
- **✎ edit button** (top-right of the card header) — opens the card's raw liftoscript line for editing. Every card shows it, so if you complete a set with different reps or weight than planned (e.g. an AMRAP or a failed top set), you can correct it on the spot. Save rewrites the line back into the note's source. Same format rules as the [Exercise Line Syntax](#the-exercise-line-syntax): one `NxW` token per set, markers first.

> The timer runs **only in memory** — it never rewrites the file every second — so it won't flood real-time sync (LiveSync) or Obsidian Git with changes.

---

## Autocomplete

While editing a note, type an exercise name after a `/` or list marker (`-`, `*`, `+`), or at the start of a line. A dropdown of exercise names from the **active database** appears; pick one to insert it. Choose between the **Native Liftosaur** database (227 entries) and the **Free Exercise DB** (876 entries) in Settings → Exercise database. With the Free Exercise DB active you can also search by muscle group or equipment (e.g. typing `chest` or `barbell`).

---

## Settings

Everything lives under **Settings → Liftoscript**:

| Setting | What it does |
| --- | --- |
| **Workout folder** | Directory where **Generate Next Workout** writes files (created automatically if missing). Empty = same folder as the active note. |
| **Default body weight** | Body weight used to compute bodyweight-set volume. |
| **Append inline to daily note** | Append the generated workout to the active daily note instead of a separate file. |
| **Active exercise database** | Choose **Native Liftosaur** (227) or **Free Exercise DB** (876) for autocomplete + card info. |
| **Free Exercise DB remote URL** / **Refresh remote database** | Point at a custom Free Exercise DB JSON and refresh the bundled copy. |
| **Custom exercise database** | Path to a JSON file to override/merge the active database (applied on save). |
| **Generate example note** | Create or refresh `Liftosaur-Example.md`, a fully worked example showing the checklist, stretch holds, bodyweight sets, Dataview metrics and quick-add buttons. |
| **Floating action button** / **Restrict FAB to folders** / **FAB folders** | Toggle an on-canvas button that appends a quick-add exercise; optionally restrict it to specific folders. |
| **Quick-add exercise templates** | Define snippet templates behind the `Liftoscript: Add <exercise>` commands. |
| **Frontmatter template** | Custom YAML template for the metrics written by **Update workout metrics**. |
| **Workout filename template** | Output filename convention, e.g. `{{workout_name}}-{{date}}`. |

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

- `total_volume` = sum of (weight × reps) over **completed** sets only. For bodyweight sets this is `(default body weight + added load) × reps` (see [Bodyweight exercises](#bodyweight-exercises)).
- `session_duration` = an **estimate**: for each completed set we add the exercise's `rest` seconds plus ~40 s of work time.
- Numbers are rounded; units default to `lb` if a block has no unit.

These keys are queryable directly from the **Dataview** plugin. A few example
queries (given each workout note is tagged `type: workout`, e.g. via frontmatter
`type: workout`):

**A log of every workout, newest first** — volume, sets, reps and duration:

```dataview
TABLE date, total_volume, completed_sets + "/" + total_sets AS "Sets", total_reps, session_duration
FROM #workout
SORT date DESC
```

**The last seven days** — which days you trained and how long:

```dataview
TABLE total_volume, session_duration
FROM #workout
WHERE date >= date(today) - dur(7 days)
SORT date DESC
```

**Session completeness** — a percentage of sets actually completed:

```dataview
TABLE completed_sets + "/" + total_sets AS "Sets done", round(100 * completed_sets / total_sets) AS "% complete"
FROM #workout
WHERE total_sets > 0
```

**A calendar view of your training days** (Dataview's `CALENDAR`):

```dataview
CALENDAR date
FROM #workout
```

> Swap `#workout` for whatever tag or folder you use, e.g. `FROM "Workouts"` or
> `FROM "Workouts" AND #upper`. If you track volume trend, note that
> `session_duration` is an estimate (rest + ~40 s of work per completed set).

---

## "Generate Next Workout" command

**Command Palette → Liftoscript: Generate Next Workout**

Creates a **new markdown file** — in the **Workout folder** set in Settings →
Liftoscript (falls back to the active note's folder when left empty) — and opens it. It:

1. Reads the active note's ````liftoscript```` blocks.
2. For each line with a `progress: lp(...)` tag, applies progressive overload (see below).
3. Resets all set markers to `[ ]` (fresh workout).
4. Adds **baseline YAML** with today's date and zeroed metrics.
5. Adds a **backlink** to the previous workout note (`previous_workout`) so you have a clickable history chain.

Example generated file:

````markdown
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
````

> New files are named `<PreviousBaseName>-<YYYY-MM-DD>.md` (a `-2`, `-3` suffix is added if the name already exists). If the configured **Workout folder** (including nested parents) doesn't exist yet, the plugin creates it automatically before writing — so a fresh vault or newly-set folder path never fails the write.

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

## Stretch Exercises

Exercises categorized as `stretch` in the built-in database — or any line tagged
manually with `type: stretch` — are treated purely as **timed holds**. Weight and
reps are ignored.

```liftoscript
[ ] [ ] [ ] Hamstring Stretch / 3x60s
```

| Part | Meaning |
| --- | --- |
| `3x60s` | **3 sets × 60-second hold**. Format is `sets x seconds`. |
| `60s\|30s` | Per-set rest after each hold (hold 60s, rest 30s). |
| `rest: N` | Exercise-level rest, used when no `60s\|30s` is given. |
| `type: stretch` | Manual tag for an exercise not in the database. |

In reading view each stretch set renders as a checkbox plus its hold duration —
no weight is shown. **Ticking a checkbox immediately starts the hold countdown**,
then the rest countdown (if configured), ending in a Notice plus chime.

Stretches are excluded from progressive overload: **Generate Next Workout** carries
them over with their durations untouched. They count toward `completed_sets` and
`session_duration` (the hold replaces the flat per-set work allowance) but add
**zero** `total_volume`.

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
[x] [ ] [ ] Pull-Up / 5xbw, 5xbw+25lb, 5xbw-10kg
```

After this session:

1. Run **Update workout metrics** to fill the frontmatter with `total_volume`, `completed_sets`, `session_duration`, etc.
2. Run **Generate Next Workout** — the new note will show Bench at `5x105lb`, OHP still at `8x42.5kg` (needs 2 successful sessions), and all markers reset to `[ ]`.
````

---

## Templater Integration (P17)

The plugin ships a standalone, Obsidian-free JS module called
`liftoscript-api.js`. Copy it into your **Templater Scripts folder**
(Settings → Templater → Script user functions folder), and its functions
become available as `tp.user.liftoscript_api`.

This is handy when you generate a daily note with Templater and want to bake
in progressive-overload data right away. Example Templater snippet:

```
<%*
const api = tp.user.liftoscript_api;
const prev = await tp.file.find_tfile("Workouts/Last Session");
const previousText = await app.vault.read(prev);
const next = api.buildNextWorkoutContent({
  previousPath: prev.path,
  previousText,
  previousTitle: prev.basename,
});
// next is the full note body (YAML + overloaded liftoscript blocks)
tR += next;
%>
```

Exported functions:

| Function | Purpose |
| --- | --- |
| `buildNextWorkoutContent({previousPath, previousText, previousTitle})` | The full next-workout note (overloads `lp()`, resets markers, zeroed YAML, backlink). |
| `computeNextExercise(parsed)` | Apply `lp()` to one parsed exercise; returns the next line + new weight. |
| `parseExerciseLine(line)` | Parse one liftoscript line into a `ParsedExercise`. |
| `summarizeWorkoutText(text)` | Compute volume / sets / reps / duration. |
| `extractLiftoscriptBlocks(text)` | Pull the raw content of all ````liftoscript```` fences. |
| `weightToToken(weight)` / `BLOCK_LANG` | Weight formatting / the `liftoscript` fence language. |

---

## Development

```bash
npm install        # first time
npm run dev        # watch-build (esbuild, non-minified)
npm run build      # production build -> main.js + liftoscript-api.js
```

- `main.ts` — plugin entry point (registers commands, suggest, post-processor).
- `parser.ts` — standalone port of Liftoscript's evaluator + weight model + linear progression + timed stretch sets.
- Build output: `main.js`, `manifest.json`, `styles.css`, and `liftoscript-api.js` (Templater module).

**No external runtime dependencies** — the plugin only uses Obsidian's standard APIs, and the notification chime is embedded as a Base64 data URI so it's fully self-contained.

### Source & mirror

The repository is hosted in parallel on both platforms, kept in sync directly:

- GitLab: <https://gitlab.com/gamephreak13/obsidian-liftoscript>
- GitHub: <https://github.com/gamephreak13/obsidian-liftoscript>

---

## Credits

This plugin wouldn't exist without these projects:

- **[Liftosaur](https://www.liftosaur.com/)** — the open-source workout app by
  Alexandr Zinchenko that created the underlying scripting engine this plugin
  ports (`parser.ts` is a standalone reimplementation of Liftosaur's evaluator,
  weight model, and linear progression).
- **[Liftoscript](https://www.liftosaur.com/docs/syntax)** — Liftosaur's
  scripting language, which this plugin renders directly inside Obsidian notes.
- **[Free Exercise DB](https://github.com/yuhonas/free-exercise-db)** — the
  open-source exercise database (yuhonas) bundled and used for autocomplete as
  an alternative to the native Liftosaur list.

Thank you!

