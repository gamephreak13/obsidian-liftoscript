import {
  ParsedExercise,
  applyLinearProgression,
  weightAddIncrement,
  weightPrint,
  weightIs,
  IWeight,
  Unit,
} from "./parser";

/*
 * progression.ts
 *
 * P11: progressive overload. Given the completed sets of an exercise that has a
 * `progress: lp(...)` tag, compute the next-session weight/reps and re-emit the
 * exercise line with the overloaded weights applied and markers reset.
 */

export interface NextExercise {
  /** The lifted line for the next session, with markers reset to "[ ]". */
  line: string;
  /** The overloaded weight that was applied to each set (if any). */
  newWeight: IWeight | null;
  increment: IWeight | null;
  decrement: IWeight | null;
  note?: string;
}

/** Format a weight tightly for liftoscript tokens, e.g. "100lb" / "42.5kg". */
export function weightToToken(weight: IWeight): string {
  const v = Math.round(weight.value * 1e2) / 1e2;
  return `${v}${weight.unit}`;
}

/** Extract lp() arguments from a progress record. */
export function lpArgs(progress: ParsedExercise["progress"]): string[] | null {
  if (!progress || progress.type !== "lp") {
    return null;
  }
  return progress.args ?? [];
}

/**
 * Compute the next exercise line for an exercise carrying a progress: lp(...)
 * tag, based on how many sets were completed.
 *
 * lp signature: lp(increment, successes, counter, decrement, failures, failCounter)
 */
export function computeNextExercise(exercise: ParsedExercise): NextExercise | null {
  const args = lpArgs(exercise.progress);
  if (!args) {
    return null;
  }
  const completedSets = exercise.sets.filter((s) => s.completed);
  const allCompleted = completedSets.length === exercise.sets.length && exercise.sets.length > 0;

  // Required reps for lp() == sum of target reps across all sets.
  const requiredReps = exercise.sets.reduce((acc, s) => acc + s.reps, 0);
  // For success we count reps as completed; for partial failure use completed reps.
  const totalReps = allCompleted
    ? requiredReps
    : completedSets.reduce((acc, s) => acc + s.reps, 0);

  const unit: Unit = exercise.sets[0]?.weight.unit ?? "lb";
  const weights = exercise.sets.map((s) => s.weight);

  const result = applyLinearProgression(args, {
    totalReps,
    requiredReps,
    weights,
  }, { unit });

  const currentWeight = exercise.sets[0].weight;
  let newWeight: IWeight = currentWeight;
  let overloaded: boolean = false;
  const inc = result.increment;

  if (result.incrementPerformed) {
    newWeight = weightAddIncrement(currentWeight, inc);
    overloaded = true;
  } else if (result.decrementPerformed && weightIs(result.decrement)) {
    newWeight = weightAddIncrement(currentWeight, weightNegate(result.decrement as IWeight));
    overloaded = true;
  }

  const hasProgressArgs = exercise.progress!.args.length > 0;
  const line = buildNextLine(
    exercise,
    overloaded ? newWeight : null,
    result.successCounter,
    result.failureCounter,
    hasProgressArgs
  );

  return {
    line,
    newWeight: overloaded ? newWeight : null,
    increment: result.incrementPerformed ? inc : null,
    decrement: result.decrementPerformed ? result.decrement as IWeight : null,
  };
}

function weightNegate(w: IWeight): IWeight {
  return { value: -w.value, unit: w.unit };
}

/**
 * Rebuild the exercise line for the next session: reset markers to "[ ]" for
 * every set, carry forward the progression counters. If `newWeight` is provided,
 * every set token is written at that weight; otherwise each set keeps its own
 * original weight.
 */
function buildNextLine(
  exercise: ParsedExercise,
  newWeight: IWeight | null,
  successCounter: number,
  failureCounter: number,
  hasProgressArgs: boolean
): string {
  const name = exercise.name;

  // Serialize set tokens: e.g. 5x100lb (or 5x105lb when overloaded).
  const tokens = exercise.sets.map((s) => {
    const w = newWeight ?? s.weight;
    return `${s.reps}x${weightToToken(w)}`;
  });
  const restBits: string[] = [];
  if (exercise.restSeconds > 0) {
    restBits.push(`rest: ${exercise.restSeconds}`);
  }
  if (hasProgressArgs) {
    // Rebuild lp() args with updated counters (args 3 = successCounter, 6 = failureCounter).
    const rebuilt = rebuildLpArgs(exercise.progress!.args, successCounter, failureCounter);
    restBits.push(rebuilt);
  }

  // Markers: one per set, all reset.
  const markers = exercise.sets.map(() => "[ ]").join(" ");
  const spec = [name, "/", tokens.join(", "), ...restBits].join(" ");

  return `${markers} ${spec}`;
}

function rebuildLpArgs(args: string[], successCounter: number, failureCounter: number): string {
  const copy = [...args];
  // lp(increment, successes, counter, decrement, failures, failCounter)
  // Only write back counter positions that the user actually supplied.
  if (copy.length > 2) {
    copy[2] = String(successCounter);
  }
  if (copy.length > 5) {
    copy[5] = String(failureCounter);
  }
  // Trim trailing empty slots so we never emit "lp(5lb, 1, 0, , , 0)".
  while (copy.length > 0 && (copy[copy.length - 1] === undefined || copy[copy.length - 1].trim() === "")) {
    copy.pop();
  }
  return `progress: lp(${copy.join(", ")})`;
}
