/*
 * templaterApi.ts
 *
 * P17: an accessible JS module for the Templater plugin. This file is bundled
 * to liftoscript-api.js; drop that file into Templater's "Scripts" folder and
 * call the exported functions via tp.user.liftoscript_api.<fn> during daily-note
 * generation. None of these modules depend on Obsidian's runtime, so the bundle
 * is self-contained.
 */

export {
  buildNextWorkoutContent,
  type NextWorkoutBuildInput,
} from "./nextWorkout";

export {
  computeNextExercise,
  weightToToken,
  type NextExercise,
} from "./progression";

export { parseExerciseLine, type ParsedExercise } from "./parser";

export {
  summarizeWorkoutText,
  type WorkoutSummary,
} from "./summary";

export {
  extractLiftoscriptBlocks,
  BLOCK_LANG,
} from "./summary";
