import { App, TFile } from "obsidian";
import { summarizeWorkoutText, WorkoutSummary } from "./summary";
import { renderTemplate, formatTemplateDate, TemplateContext } from "./template";
import type { Unit } from "./parser";

/*
 * frontmatter.ts
 *
 * P10 + P26: injects the computed workout metrics into the note's YAML
 * frontmatter. P26 refactors the generation to render a user-defined template
 * (settings.frontmatterTemplate) instead of a hardcoded YAML structure, while
 * the default template below preserves the original, Dataview-friendly keys
 * (total_volume, completed_sets, session_duration, ...).
 */

/** Format seconds as "MM:SS" (or "H:MM:SS" if >= 1 hour). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = sec.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export interface FrontmatterMetrics {
  total_volume: number;
  total_volume_unit: string;
  completed_sets: number;
  total_sets: number;
  total_reps: number;
  exercises_completed: number;
  session_duration: string;
  session_duration_seconds: number;
  last_updated: string;
}

export function buildMetrics(summary: WorkoutSummary): FrontmatterMetrics {
  return {
    total_volume: Math.round(summary.totalVolume * 100) / 100,
    total_volume_unit: summary.totalVolumeUnit ?? "lb",
    completed_sets: summary.completedSets,
    total_sets: summary.totalSets,
    total_reps: summary.totalReps,
    exercises_completed: summary.exercisesCompleted,
    session_duration: formatDuration(summary.estimatedDurationSeconds),
    session_duration_seconds: Math.round(summary.estimatedDurationSeconds),
    last_updated: new Date().toISOString(),
  };
}

/**
 * Build the variable context available to the frontmatter template. Returns the
 * shared metric keys plus note-specific ones (date, previous_workout,
 * workout_name) the caller can override.
 */
export function buildFrontmatterContext(
  metrics: FrontmatterMetrics,
  extras: TemplateContext = {}
): TemplateContext {
  return {
    date: formatTemplateDate(new Date()),
    ...(metrics as unknown as TemplateContext),
    ...extras,
  };
}

/** Render the YAML body (between the `---` fences) from a template. */
export function renderFrontmatterBody(
  template: string,
  metrics: FrontmatterMetrics,
  extras: TemplateContext = {}
): string {
  return renderTemplate(template, buildFrontmatterContext(metrics, extras)).trim();
}

/** Wrap a rendered body in YAML frontmatter fences. */
export function wrapFrontmatter(body: string): string {
  return `---\n${body}\n---`;
}

/** Replace the leading YAML frontmatter of `text` with `block`, or prepend it. */
export function replaceFrontmatter(text: string, block: string): string {
  const t = text.replace(/^\uFEFF/, "");
  const hasFrontmatter = /^---\n/.test(t);
  if (hasFrontmatter) {
    const rest = t.replace(/^---\n[\s\S]*?\n---\s*\n?/, "");
    return (block + "\n" + rest).replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  }
  return (block + "\n\n" + t).replace(/^\s+/, "");
}

export async function updateWorkoutFrontmatter(
  app: App,
  file: TFile,
  text: string,
  template?: string,
  bodyWeight?: { value: number; unit: Unit }
): Promise<void> {
  const summary = summarizeWorkoutText(text, {
    defaultBodyWeight: bodyWeight?.value,
    defaultBodyWeightUnit: bodyWeight?.unit,
  });
  const metrics = buildMetrics(summary);
  const body = renderFrontmatterBody(template ?? "", metrics, {});
  const block = wrapFrontmatter(body);

  await app.vault.process(file, (current) => replaceFrontmatter(current, block));
}
