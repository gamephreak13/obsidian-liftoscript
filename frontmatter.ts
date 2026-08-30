import { App, TFile } from "obsidian";
import { summarizeWorkoutText, WorkoutSummary } from "./summary";

/*
 * frontmatter.ts
 *
 * P10: injects the computed workout metrics into the note's YAML frontmatter
 * using Obsidian's app.fileManager.processFrontMatter(). Keys are shaped for
 * easy Dataview queries: total_volume, completed_sets, session_duration, etc.
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

export async function updateWorkoutFrontmatter(
  app: App,
  file: TFile,
  text: string
): Promise<void> {
  const summary = summarizeWorkoutText(text);
  const metrics = buildMetrics(summary);

  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    for (const [key, value] of Object.entries(metrics)) {
      frontmatter[key] = value;
    }
  });
}
