import nativeData from "./exercises.json";
import freeData from "./freeExercises.json";

/*
 * P21-P24: centralized exercise database registry. Two datasets are bundled
 * locally (both shipped in the plugin):
 *   - nativeData (exercises.json)      - the Native Liftosaur database
 *   - freeData   (freeExercises.json)  - the open-source Free Exercise DB
 *     (https://github.com/yuhonas/free-exercise-db, distilled to the fields the
 *     plugin needs and compacted to keep the bundle small).
 *
 * The active dataset is chosen at runtime via setActiveDatabase() (P22) and all
 * lookups read from it. Free Exercise DB records use a different schema (P23),
 * so normalizeFreeExercise() maps them onto the native Exercise shape: name
 * stays the primary identifier and the muscles/category are preserved for
 * search + stretch/strength parser logic.
 *
 * NOTE: this module deliberately does NOT import "obsidian" so it stays usable
 * from the Templater API bundle (which runs Obsidian-free under Node).
 */

export type DatabaseId = "native" | "free" | "free-remote";

export const DATABASE_LABELS: Record<DatabaseId, string> = {
  native: "Native Liftosaur",
  free: "Free Exercise DB (Local)",
  "free-remote": "Free Exercise DB (Remote)",
};

/** A normalized exercise record. Free-DB-only fields are optional extras. */
export interface Exercise {
  id: string;
  name: string;
  equipment: string;
  category?: "stretch" | "strength" | string;
  /** Primary muscles the exercise targets (Free Exercise DB). */
  primaryMuscles?: string[];
  /** Secondary / supporting muscles (Free Exercise DB). */
  secondaryMuscles?: string[];
}

interface FreeExerciseRecord {
  id?: unknown;
  name: string;
  equipment?: string;
  category?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
}

/**
 * P23: normalize a Free Exercise DB record onto the native Exercise schema.
 *   - name is the primary identifier (unchanged, canonical casing).
 *   - primaryMuscles / secondaryMuscles are carried through for search.
 *   - category "stretching" is mapped to "stretch" so the parser's stretch
 *     detection (which keys on category === "stretch") treats Free-DB stretches
 *     the same as native ones; "strength" and the other free categories stay as
 *     strength-like.
 */
export function normalizeFreeExercise(record: FreeExerciseRecord): Exercise {
  const name = typeof record?.name === "string" ? record.name : "";
  return {
    id:
      typeof record?.id === "string"
        ? record.id
        : name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    equipment: typeof record?.equipment === "string" ? record.equipment : "",
    category:
      record?.category === "stretching"
        ? "stretch"
        : typeof record?.category === "string"
          ? record.category
          : undefined,
    primaryMuscles: Array.isArray(record?.primaryMuscles)
      ? record.primaryMuscles
      : [],
    secondaryMuscles: Array.isArray(record?.secondaryMuscles)
      ? record.secondaryMuscles
      : [],
  };
}

const NATIVE_EXERCISES = nativeData as Exercise[];
const FREE_EXERCISES = (freeData as FreeExerciseRecord[]).map(normalizeFreeExercise);

let activeDatabase: DatabaseId = "free";
let customOverrides: Record<string, unknown>[] = [];
let remoteFreeExercises: Exercise[] | null = null;

/** Set which database is active (P22). "free" swaps stretch detection, too. */
export function setActiveDatabase(id: DatabaseId): void {
  activeDatabase = id;
}

/** The currently active database id. */
export function getActiveDatabase(): DatabaseId {
  return activeDatabase;
}

/**
 * Store the fetched Free Exercise DB records (P29 remote). Populating this
 * enables the "free-remote" mode; leaving it null/empty keeps the bundled
 * local copy as the offline fallback.
 */
export function setFreeRemoteExercises(records: Array<Record<string, unknown>>): void {
  remoteFreeExercises = records.map((r) => normalizeFreeExercise(r as unknown as FreeExerciseRecord));
}

/** The raw (non-merged) active dataset. */
export function getBaseExercises(): Exercise[] {
  if (activeDatabase === "free-remote") {
    // Fall back to the bundled local Free DB when remote isn't available yet
    // or a fetch previously failed.
    return remoteFreeExercises && remoteFreeExercises.length > 0
      ? remoteFreeExercises
      : FREE_EXERCISES;
  }
  return activeDatabase === "free" ? FREE_EXERCISES : NATIVE_EXERCISES;
}

export function getExercises(): Exercise[] {
  const base = getBaseExercises();
  if (customOverrides.length === 0) {
    return base;
  }
  const merged = base.slice();
  const indexByName = new Map<string, number>();
  merged.forEach((e, i) => {
    if (e?.name) {
      indexByName.set(e.name.toLowerCase(), i);
    }
  });
  for (const raw of customOverrides) {
    const name = typeof raw?.name === "string" ? raw.name : "";
    if (!name) {
      continue;
    }
    const category =
      typeof raw?.category === "string"
        ? raw.category === "stretching"
          ? "stretch"
          : raw.category
        : undefined;
    const exercise: Exercise = {
      id: typeof raw?.id === "string" ? raw.id : name.toLowerCase().replace(/\s+/g, "-"),
      name,
      equipment: typeof raw?.equipment === "string" ? raw.equipment : "",
      category,
      primaryMuscles: Array.isArray(raw?.primaryMuscles)
        ? raw.primaryMuscles as string[]
        : undefined,
    };
    const existingIdx = indexByName.get(name.toLowerCase());
    if (existingIdx != null) {
      merged[existingIdx] = exercise;
    } else {
      indexByName.set(name.toLowerCase(), merged.length);
      merged.push(exercise);
    }
  }
  return merged;
}

/**
 * P18: merge a custom JSON database (overrides by name) on top of the active
 * dataset. Pass an empty array to clear the custom overrides.
 */
export function setCustomExercises(custom: Array<Record<string, unknown>>): void {
  customOverrides = custom;
}

/** Find an exercise by its (case-insensitive) name in the active dataset. */
export function findExercise(raw: string): Exercise | undefined {
  return getExercises().find(
    (e) => e.name.toLowerCase() === exerciseNameFromLine(raw).toLowerCase()
  );
}

/**
 * Extract the exercise name from a liftoscript line. Names may contain slashes
 * (e.g. "3/4 Sit-Up"), so the split point is the first slash preceded by
 * whitespace — the "Name / spec" separator. With no such slash the whole string
 * is the name (a slash without surrounding spaces is part of the name).
 */
export function exerciseNameFromLine(line: string): string {
  const trimmed = line.trim();
  const afterMarkers = trimmed.replace(/^(\[[ xX]\]\s*)+/, "").trim();
  for (let i = 1; i < afterMarkers.length; i++) {
    if (afterMarkers[i] === "/" && /\s/.test(afterMarkers[i - 1])) {
      return afterMarkers.substring(0, i).trim();
    }
  }
  return afterMarkers;
}

/** True when the given exercise name is a stretch in the active dataset. */
export function isStretchName(name: string): boolean {
  return getExercises().some(
    (e) => e.category === "stretch" && e.name.toLowerCase() === name.trim().toLowerCase()
  );
}
