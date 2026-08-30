import { extractLiftoscriptBlocks, BLOCK_LANG } from "./summary";
import { parseExerciseLine } from "./parser";
import { computeNextExercise } from "./progression";

/*
 * nextWorkout.ts
 *
 * P12 + P13: builds the content for the "Generate Next Workout" command.
 * It reads the liftoscript blocks of the previous workout, applies progressive
 * overload (lp) to any progression-tagged exercises, and produces a new note
 * with baseline YAML frontmatter and a backlink to the previous note.
 */

export interface NextWorkoutBuildInput {
  previousPath: string;
  previousText: string;
  previousTitle: string;
}

/** Format today's date as YYYY-MM-DD. */
function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Serialize a non-progress line verbatim but with markers reset to "[ ]". */
function resetMarkers(line: string): string {
  // Replace each "[x]"/"[ ]" occurrence with "[ ]".
  return line.replace(/\[x\]|\[ \]/gi, "[ ]");
}

export function buildNextWorkoutContent(input: NextWorkoutBuildInput): string {
  const date = today();
  const previousLink = `[[${input.previousTitle}]]`;

  const blocks = extractLiftoscriptBlocks(input.previousText);

  const renderedBlocks = blocks.map((block) => {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const nextLines = lines.map((line) => {
      const ex = parseExerciseLine(line);
      const next = ex.progress ? computeNextExercise(ex) : null;
      if (next) {
        return next.line;
      }
      return resetMarkers(line);
    });

    return "```" + BLOCK_LANG + "\n" + nextLines.join("\n") + "\n```";
  });

  const yaml = [
    "---",
    `date: ${date}`,
    "total_volume: 0",
    `total_volume_unit: lb`,
    "completed_sets: 0",
    "exercises_completed: 0",
    "session_duration: 0:00",
    "session_duration_seconds: 0",
    `previous_workout: ${previousLink}`,
    "---",
  ].join("\n");

  const parts = [
    yaml,
    "",
    "# Workout",
    "",
    ...renderedBlocks.length ? renderedBlocks : ["```" + BLOCK_LANG + "\n```"],
    "",
  ];

  return parts.join("\n");
}

/** Default exercise line when the previous note had no liftoscript blocks. */
export const FALLBACK_LINE =
  "# Today's plan. Replace the sample below and add your own sets." +
  "\n```" + BLOCK_LANG + "\n[ ] [ ] [ ] Sample Exercise / 5x100lb, rest: 90\n```";
