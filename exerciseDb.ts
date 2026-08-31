import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo } from "obsidian";
import exerciseData from "./exercises.json";

/*
 * exerciseDb.ts
 *
 * Static exercise database (loaded from exercises.json) plus an EditorSuggest
 * that provides an autocomplete dropdown for exercise names while typing inside
 * the editor.
 */

export interface Exercise {
  id: string;
  name: string;
  equipment: string;
  category?: "stretch" | "strength" | string;
}

let EXERCISES: Exercise[] = exerciseData as Exercise[];

export function getExercises(): Exercise[] {
  return EXERCISES;
}

/**
 * Replace the active exercise database with a custom one (P18: custom JSON
 * import). Entries may override an existing exercise by matching id (or name)
 * or be appended when no match exists. Pass an empty array to restore the
 * built-in database.
 */
export function setCustomExercises(custom: Array<Record<string, unknown>>): void {
  if (!custom || custom.length === 0) {
    EXERCISES = exerciseData as Exercise[];
    return;
  }
  const merged: Exercise[] = (exerciseData as Exercise[]).slice();
  const indexByName = new Map<string, number>();
  merged.forEach((e, i) => {
    if (e?.name) {
      indexByName.set(e.name.toLowerCase(), i);
    }
  });
  for (const raw of custom) {
    const name = typeof raw.name === "string" ? raw.name : "";
    if (!name) {
      continue;
    }
    const exercise: Exercise = {
      id: typeof raw.id === "string" ? raw.id : name.toLowerCase().replace(/\s+/g, "-"),
      name,
      equipment: typeof raw.equipment === "string" ? raw.equipment : "",
      category: typeof raw.category === "string" ? raw.category : undefined,
    };
    const existingIdx = indexByName.get(name.toLowerCase());
    if (existingIdx != null) {
      merged[existingIdx] = exercise;
    } else {
      indexByName.set(name.toLowerCase(), merged.length);
      merged.push(exercise);
    }
  }
  EXERCISES = merged;
}

export function findExercise(raw: string): Exercise | undefined {
  const name = raw
    .split("/")[0]
    .trim()
    .replace(/^[-+*]\s*/, "");
  return getExercises().find((e) => e.name.toLowerCase() === name.toLowerCase());
}

/* ------------------------------------------------------------------ */
/* EditorSuggest for exercise names                                    */
/* ------------------------------------------------------------------ */

interface Suggestion extends Exercise {
  match: number;
}

export class ExerciseSuggest extends EditorSuggest<Suggestion> {
  constructor(app: App) {
    super(app);
  }

  getSuggestions(context: EditorSuggestContext): Suggestion[] {
    const query = context.query.toLowerCase();
    if (!query) {
      return [];
    }
    return getExercises()
      .map((e) => {
        const lower = e.name.toLowerCase();
        const idx = lower.indexOf(query);
        if (idx === -1) {
          return undefined;
        }
        return { ...e, match: idx };
      })
      .filter((e): e is Suggestion => e != null)
      .sort((a, b) => a.match - b.match || a.name.length - b.name.length)
      .slice(0, 10);
  }

  renderSuggestion(suggestion: Suggestion, el: HTMLElement): void {
    const container = el.createDiv({ cls: "liftoscript-suggestion" });
    container.createDiv({ text: suggestion.name, cls: "liftoscript-suggestion-name" });
    container.createDiv({ text: suggestion.equipment, cls: "liftoscript-suggestion-equipment" });
  }

  selectSuggestion(suggestion: Suggestion, evt: MouseEvent | KeyboardEvent): void {
    if (!this.context) {
      return;
    }
    const editor = this.context.editor;
    const start = this.context.start;
    editor.replaceRange(suggestion.name, start, this.context.end);
    editor.setCursor({
      line: start.line,
      ch: start.ch + suggestion.name.length,
    });
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: unknown): EditorSuggestTriggerInfo | null {
    const line = editor.getLine(cursor.line);
    const upToCursor = line.slice(0, cursor.ch);

    // Trigger when typing after a bullet/list dash or after a "/" separator.
    const match = upToCursor.match(/(?:\/|^|\s|[-*+])\s*([A-Za-z][A-Za-z0-9 _\-']*)$/);
    if (!match) {
      return null;
    }
    const query = match[1];
    const startCh = cursor.ch - query.length;
    return {
      start: { line: cursor.line, ch: startCh },
      end: cursor,
      query,
    };
  }
}
