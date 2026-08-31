import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo } from "obsidian";
import { Exercise, getActiveDatabase, getExercises } from "./exerciseDb";

/*
 * exerciseSuggest.ts
 *
 * P24: EditorSuggest autocomplete. Reads from the currently active exercise
 * database (getExercises). When the Free Exercise DB is active, search is
 * extended to primaryMuscles / secondaryMuscles and equipment, so typing
 * "chest" or "barbell" suggests matching exercises (e.g. "Barbell Bench Press").
 */

interface Suggestion extends Exercise {
  match: number;
}

export class ExerciseSuggest extends EditorSuggest<Suggestion> {
  constructor(app: App) {
    super(app);
  }

  getSuggestions(context: EditorSuggestContext): Suggestion[] {
    const query = context.query.toLowerCase().trim();
    if (!query) {
      return [];
    }
    const freeMode = getActiveDatabase() === "free";
    return getExercises()
      .map((e) => {
        let best = -1;
        const inName = e.name.toLowerCase().indexOf(query);
        if (inName !== -1) {
          best = inName;
        }
        // Free DB: also index muscles and equipment so "chest"/"barbell" work.
        if (freeMode) {
          for (const m of [...(e.primaryMuscles ?? []), ...(e.secondaryMuscles ?? [])]) {
            const idx = m.toLowerCase().indexOf(query);
            if (idx !== -1 && (best === -1 || idx + 100 < best)) {
              best = idx + 100;
            }
          }
          if (best === -1 && e.equipment && e.equipment.toLowerCase().indexOf(query) !== -1) {
            best = 1;
          }
          if (best === -1) {
            return undefined;
          }
        } else if (best === -1) {
          return undefined;
        }
        return { ...e, match: best };
      })
      .filter((e): e is Suggestion => e != null)
      .sort((a, b) => a.match - b.match || a.name.length - b.name.length)
      .slice(0, 10);
  }

  renderSuggestion(suggestion: Suggestion, el: HTMLElement): void {
    const freeMode = getActiveDatabase() === "free";
    const container = el.createDiv({ cls: "liftoscript-suggestion" });
    container.createDiv({ text: suggestion.name, cls: "liftoscript-suggestion-name" });
    const detail = freeMode
      ? [suggestion.equipment, ...(suggestion.primaryMuscles ?? [])]
          .filter(Boolean)
          .join(" · ")
      : suggestion.equipment;
    container.createDiv({ text: detail, cls: "liftoscript-suggestion-equipment" });
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
