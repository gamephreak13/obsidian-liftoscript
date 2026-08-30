import { parseExerciseLine, ParsedExercise } from "./parser";

/*
 * summary.ts
 *
 * P9: workout summarization. Parses the active note's ```liftoscript blocks and
 * computes session metrics: total volume (weight x reps), completed sets,
 * total reps, and an estimated session duration based on rest periods plus a
 * flat per-set work time.
 */

export interface WorkoutSummary {
  exercises: ParsedExercise[];
  totalVolume: number;
  totalVolumeUnit: "lb" | "kg" | null;
  completedSets: number;
  totalSets: number;
  totalReps: number;
  exercisesCompleted: number;
  estimatedDurationSeconds: number;
  /** Set-time allowance in seconds per set (used to estimate work duration). */
  workSecondsPerSet: number;
}

export const BLOCK_LANG = "liftoscript";

/** Extract the raw content of all ```liftoscript blocks from a markdown string. */
export function extractLiftoscriptBlocks(text: string): string[] {
  const blocks: string[] = [];
  if (!text) {
    return blocks;
  }
  const fence = /```\s*liftoscript\s*\n([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text))) {
    blocks.push(m[1]);
  }
  return blocks;
}

export interface SummaryOptions {
  workSecondsPerSet?: number;
}

export function summarizeWorkoutText(
  text: string,
  opts: SummaryOptions = {}
): WorkoutSummary {
  const workSecondsPerSet = opts.workSecondsPerSet ?? 40;

  const exercises: ParsedExercise[] = [];
  for (const block of extractLiftoscriptBlocks(text)) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    for (const line of lines) {
      const ex = parseExerciseLine(line);
      if (ex.sets.length > 0 || ex.name) {
        exercises.push(ex);
      }
    }
  }

  let totalVolume = 0;
  let totalVolumeUnit: "lb" | "kg" | null = null;
  let completedSets = 0;
  let totalSets = 0;
  let totalReps = 0;
  let exercisesCompleted = 0;
  let estimatedDurationSeconds = 0;

  for (const ex of exercises) {
    const doneSets = ex.sets.filter((s) => s.completed);
    if (doneSets.length === ex.sets.length && ex.sets.length > 0) {
      exercisesCompleted += 1;
    }
    for (const set of ex.sets) {
      totalSets += 1;
      const weight = set.weight;
      const numeric = typeof weight === "number" ? weight : weight.value ?? NaN;
      if (set.completed && !Number.isNaN(numeric)) {
        totalVolume += numeric * set.reps;
        completedSets += 1;
        totalReps += set.reps;
        const unit = typeof weight === "number" ? null : weight.unit;
        if (totalVolumeUnit == null && unit != null && set.seconds == null) {
          totalVolumeUnit = unit;
        }
        // Timed (stretch) sets count their hold as the work time; strength
        // sets use the fixed per-set allowance.
        estimatedDurationSeconds +=
          (set.restSeconds ?? ex.restSeconds) + (set.seconds ?? workSecondsPerSet);
      }
    }
  }

  return {
    exercises,
    totalVolume,
    totalVolumeUnit,
    completedSets,
    totalSets,
    totalReps,
    exercisesCompleted,
    estimatedDurationSeconds,
    workSecondsPerSet,
  };
}
