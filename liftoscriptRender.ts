import { MarkdownPostProcessorContext, MarkdownPostProcessor, Plugin } from "obsidian";
import { parseExerciseLine, ParsedExercise, ParsedExerciseSet, weightPrint } from "./parser";
import { startRest, stopRest } from "./restTimer";
import { notifyRestComplete } from "./notify";
import { startStretchHold, attachStretchTimer, stopStretchTimer, StretchTick } from "./stretchTimer";

/*
 * liftoscriptRender.ts
 *
 * A MarkdownPostProcessor that intercepts ```liftoscript code blocks and renders
 * them into an interactive HTML UI. Each exercise line becomes a card with:
 *   - one checkbox per set
 *   - a visual countdown timer for the configured rest period
 *
 * The countdown timer runs strictly in memory (see restTimer.ts) and never
 * rewrites the markdown file, protecting real-time sync (LiveSync/Obsidian Git).
 */

export const BLOCK_LANG = "liftoscript";

export interface RenderCallbacks {
  /** Fired when a set checkbox is toggled. Carries the source line and the
   *  char offset of the marker within that line so the caller can persist it. */
  onSetToggled?: (
    lineText: string,
    markerStart: number,
    markerEnd: number,
    completed: boolean,
    sourcePath: string
  ) => void;
}

function renderSeconds(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

interface CardOptions extends RenderCallbacks {
  sourcePath: string;
  completedMask?: boolean[];
}

function buildExerciseCard(
  container: HTMLElement,
  exercise: ParsedExercise,
  opts: CardOptions
): void {
  const card = container.createDiv({ cls: "liftoscript-exercise" });
  const header = card.createDiv({ cls: "liftoscript-exercise-header" });
  header.createDiv({ text: exercise.name, cls: "liftoscript-exercise-name" });

  const setsContainer = card.createDiv({ cls: "liftoscript-sets" });

  if (exercise.isStretch) {
    buildStretchSets(setsContainer, exercise, opts);
    return;
  }

  exercise.sets.forEach((set, i) => {
    const row = setsContainer.createDiv({ cls: "liftoscript-set" });
    const checkbox = row.createEl("input", {
      type: "checkbox",
      cls: "liftoscript-set-checkbox",
    });
    const isCompleted = opts.completedMask?.[i] ?? set.completed;
    checkbox.checked = isCompleted;

    const label = row.createDiv({ cls: "liftoscript-set-label" });
    label.setText(`${set.reps} reps @ ${weightPrint(set.weight)}`);

    checkbox.addEventListener("change", () => {
      set.completed = checkbox.checked;
      row.classList.toggle("liftoscript-set-done", checkbox.checked);
      if (set.markerStart != null && set.markerEnd != null) {
        opts.onSetToggled?.(
          exercise.raw,
          set.markerStart,
          set.markerEnd,
          checkbox.checked,
          opts.sourcePath
        );
      }
    });
    row.classList.toggle("liftoscript-set-done", isCompleted);
  });

  // Rest timer controls
  if (exercise.restSeconds > 0) {
    const restRow = card.createDiv({ cls: "liftoscript-rest" });
    const timerLabel = restRow.createDiv({
      cls: "liftoscript-rest-timer",
      text: `Rest: ${renderSeconds(exercise.restSeconds)}`,
    });
    const startBtn = restRow.createEl("button", { text: "Start rest", cls: "liftoscript-rest-start" });
    const stopBtn = restRow.createEl("button", { text: "Stop", cls: "liftoscript-rest-stop" });
    stopBtn.setAttribute("style", "display:none");

    startBtn.addEventListener("click", () => {
      startBtn.setAttribute("style", "display:none");
      stopBtn.removeAttribute("style");
      startRest(exercise.restSeconds, (remaining) => {
        timerLabel.setText(`Rest: ${renderSeconds(remaining)}`);
        if (remaining === 0) {
          // Timer ticked to zero - restore button state
          startBtn.setText("Rest again");
          startBtn.removeAttribute("style");
          stopBtn.setAttribute("style", "display:none");
        }
      }, () => {
        // Fires once when the timer reaches zero
        notifyRestComplete(`Rest complete for ${exercise.name}!`);
      });
      if (exercise.restSeconds <= 0) {
        startBtn.removeAttribute("style");
        stopBtn.setAttribute("style", "display:none");
      }
    });

    stopBtn.addEventListener("click", () => {
      stopRest();
      timerLabel.setText(`Rest: ${renderSeconds(exercise.restSeconds)}`);
      startBtn.setText("Start rest");
      startBtn.removeAttribute("style");
      stopBtn.setAttribute("style", "display:none");
    });
  }
}

/**
 * Build the set rows for a stretch exercise. No weight is shown; each row has a
 * checkbox, the hold duration, and a countdown. Ticking a set starts the hold
 * countdown, then the rest countdown if one is configured. Countdown state
 * lives in stretchTimer.ts so it survives Obsidian re-rendering the note after
 * the completion marker is persisted.
 */
function buildStretchSets(
  container: HTMLElement,
  exercise: ParsedExercise,
  opts: CardOptions
): void {
  exercise.sets.forEach((set, i) => {
    const hold = set.seconds ?? 0;
    const rest = set.restSeconds ?? exercise.restSeconds;
    const key = `${opts.sourcePath}|${exercise.raw}|${set.setNumber}`;

    const row = container.createDiv({ cls: "liftoscript-set liftoscript-stretch-set" });
    const checkbox = row.createEl("input", { type: "checkbox", cls: "liftoscript-set-checkbox" });
    const isCompleted = opts.completedMask?.[i] ?? set.completed;
    checkbox.checked = isCompleted;

    const label = row.createDiv({ cls: "liftoscript-set-label" });
    label.setText(rest > 0 ? `${hold}s hold + ${rest}s rest` : `${hold}s hold`);

    const timer = row.createDiv({ cls: "liftoscript-rest-timer liftoscript-stretch-timer" });
    timer.setText(`Hold ${renderSeconds(hold)}`);

    const updateTimer = (tick: StretchTick) => {
      if (tick.phase === "hold") {
        timer.setText(`Hold ${renderSeconds(tick.remaining)}`);
      } else if (tick.phase === "rest") {
        timer.setText(`Rest ${renderSeconds(tick.remaining)}`);
      } else {
        timer.setText("Done");
      }
    };

    // If a session is already running (e.g. this render follows a marker
    // write), point it at the fresh timer element and resync its text.
    attachStretchTimer(key, updateTimer);

    checkbox.addEventListener("change", () => {
      set.completed = checkbox.checked;
      row.classList.toggle("liftoscript-set-done", checkbox.checked);
      if (set.markerStart != null && set.markerEnd != null) {
        opts.onSetToggled?.(
          exercise.raw,
          set.markerStart,
          set.markerEnd,
          checkbox.checked,
          opts.sourcePath
        );
      }
      if (checkbox.checked) {
        startStretchHold({
          key,
          hold,
          rest,
          message: `Stretch complete for ${exercise.name}!`,
          onTick: updateTimer,
        });
      } else {
        stopStretchTimer(key);
        timer.setText(`Hold ${renderSeconds(hold)}`);
      }
    });

    row.classList.toggle("liftoscript-set-done", isCompleted);
  });
}

export function renderLiftoscriptBlocks(
  el: HTMLElement,
  code: string,
  opts: CardOptions | RenderCallbacks & { sourcePath: string }
): void {
  const container = el.createDiv({ cls: "liftoscript" });
  // Split code into exercise lines
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  lines.forEach((line) => {
    const exercise = parseExerciseLine(line);
    if (exercise.sets.length > 0 || exercise.name) {
      buildExerciseCard(container, exercise, {
        onSetToggled: opts.onSetToggled,
        sourcePath: opts.sourcePath,
      });
    }
  });
}

export function registerLiftoscriptPostProcessor(plugin: Plugin, opts?: RenderCallbacks): MarkdownPostProcessor {
  const processor: MarkdownPostProcessor = (el, ctx) => {
    // Only process code blocks whose info string is "liftoscript".
    const codeBlocks = el.querySelectorAll(
      `pre > code.language-${BLOCK_LANG}, pre.language-${BLOCK_LANG} > code`
    );
    if (codeBlocks.length === 0) {
      return;
    }
    codeBlocks.forEach((codeEl) => {
      const code = codeEl.textContent ?? "";
      const wrapper = codeEl.parentElement;
      if (wrapper) {
        const container = document.createElement("div");
        wrapper.replaceWith(container);
        renderLiftoscriptBlocks(container, code, {
          onSetToggled: opts?.onSetToggled,
          sourcePath: ctx.sourcePath,
        });
      }
    });
  };

  return plugin.registerMarkdownPostProcessor(processor);
}
