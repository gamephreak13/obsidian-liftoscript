---
date: 2026-08-30
type: workout
tags:
  - example
  - liftoscript
total_volume: 0
total_volume_unit: lb
completed_sets: 0
total_sets: 0
total_reps: 0
exercises_completed: 0
session_duration: 0:00
session_duration_seconds: 0
---

# Liftoscript Example Workout

This note showcases the Liftoscript plugin. Open it in **Reading view** to see the
rendered UI; switch to **Source mode** to see the raw syntax that drives it.

---

## 1. A basic exercise (no progression)

A single line with the workout name before `/`, then one `NxW` token **per set**.
You need one `[ ]` / `[x]` marker per set.

````markdown
```liftoscript
[ ] [ ] [ ] Bench Press / 5x100lb, 5x100lb, 5x100lb, rest: 90
```
````

Tick a checkbox in reading view and the matching `[ ]` becomes `[x]` in source.

---

## 2. Mixed / partial completion

Mark some sets done. Toggling the checkbox writes `[x]` back into the note.

````markdown
```liftoscript
[x] [x] [ ] [ ] Deadlift / 5x200lb, 5x200lb, 5x185lb, 5x185lb, rest: 120
```
````

> Note the per-set weights: `5x185lb` is a lighter "back-off" set. When a line has
> no `progress:` tag, these are preserved as-is on the next generated workout.

---

## 3. Progressive overload with `lp()`

All sets must be **completed** to count as a successful session. With
`progress: lp(5lb, 1, 0)`, completing all 5 sets means the next generated workout
will use `5x105lb`.

````markdown
```liftoscript
[x] [x] [x] [x] [x] Bench Press / 5x100lb, 5x100lb, 5x100lb, 5x100lb, 5x100lb, rest: 90, progress: lp(5lb, 1, 0)
```
````

With **2 successful sessions** required (`lp(2.5kg, 2, 0)`), the weight only bumps
once two workouts are both fully complete:

````markdown
```liftoscript
[ ] [ ] [ ] OHP / 8x42.5kg, 8x42.5kg, 8x42.5kg, rest: 120, progress: lp(2.5kg, 2, 0)
```
````

---

## 4. Multiple sets, varied weights, no progression

A mix of working and back-off sets with a shorter rest, untouched by `lp()`:

````markdown
```liftoscript
[x] [x] [ ] [ ] [ ] Dips / 10x0lb, 10x0lb, 10x0lb, 10x0lb, 10x0lb, rest: 60
```
````

---

## 5. Autocomplete

In **Source/Edit** mode, after a `/` or a list marker (`-`, `*`, `+`), start typing
an exercise name (e.g. `Squat`) and a dropdown of built-in exercises appears.

---

## 6. Metrics in frontmatter

Run **Command Palette → Liftoscript: Update workout metrics in frontmatter** to
fill the YAML at the top of this note. It computes volume, completed sets, reps and
an estimated duration from the completed sets above:

- `total_volume` — sum of (weight × reps) for completed sets
- `completed_sets` / `total_sets` / `total_reps`
- `exercises_completed`
- `session_duration` / `session_duration_seconds` (~40 s work + rest per set)
- `last_updated`

These keys are Dataview-friendly. Example query:

```dataview
TABLE total_volume, completed_sets, session_duration
FROM "Workouts"
```

---

## 7. Generate the next workout

**Command Palette → Liftoscript: Generate Next Workout** creates a new file
(`Liftoscript Example Workout-2026-08-30.md` style name) in this folder with:

- Today's date in YAML + zeroed metrics
- The `progress:` exercises **overloaded** (e.g. Bench → `5x105lb`)
- All markers reset to `[ ]`
- A backlink to this note via `previous_workout`

---

## 8. Rest timer + notification

Any exercise with a `rest:` value gets a **Start rest** button in reading view. When
it hits `0:00`, you get an Obsidian **Notice** plus a short **audio chime** (embedded
in the plugin — no external file needed).

---

## 9. Stretch exercises

Stretches are timed holds, not weighted sets — weight and reps are ignored. Use
`sets x seconds`, with an optional per-set rest via `60s|30s`:

````markdown
```liftoscript
[ ] [ ] [ ] Hamstring Stretch / 3x60s
[ ] [ ] [ ] Standing Quad Stretch / 2x45s|30s
[ ] [ ] [ ] [ ] Deep Squat Hold / 4x40s, rest: 20, type: stretch
```
````

- `3x60s` = 3 sets of 60-second holds; `60s|30s` = hold 60s then rest 30s (per set).
- Names matching the built-in stretch category (Hamstring Stretch, Calf Stretch, etc.)
  are detected automatically; anything else needs a `type: stretch` tag.
- **Ticking a set checkbox starts the hold timer immediately**, then the rest
  timer, and finally a Notice + chime. No weight is ever shown.
- Stretches skip progressive overload in **Generate Next Workout** — durations
  carry over untouched — and add no `total_volume`, only sets and duration.

---

## Every feature at a glance

````markdown
```liftoscript
[x] [ ] [ ] Basic / 5x100lb, 5x100lb, 5x100lb, rest: 90
[x] [x] [x] [x] [x] Progressing / 5x100lb, 5x100lb, 5x100lb, 5x100lb, 5x100lb, rest: 90, progress: lp(5lb, 1, 0)
[] [] [] [] [] Varied / 5x100lb, 5x100lb, 5x95lb, 5x95lb, 5x95lb, rest: 60
[x] [ ] [ ] Hamstring Stretch / 3x60s|30s
```
````

**Pro tips**

- One `NxW` token = **one set**; commas separate sets; markers line up 1:1 with sets.
- `lb` / `kg` units are both supported: `8x42.5kg`.
- The timer runs only in memory, so real-time sync (LiveSync) and Obsidian Git
  won't get flooded with per-second edits.
