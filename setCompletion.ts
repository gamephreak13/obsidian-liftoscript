import { App, TFile } from "obsidian";
import { atomicModify } from "./atomicWrite";

/*
 * setCompletion.ts
 *
 * P8: binds rendered checkboxes to the actual markdown file. When a set is
 * toggled, we rewrite the "[ ]"/"[x]" completion marker at its known char offset
 * in the source line and persist via a serialized, atomic write.
 *
 * Writes are debounced/batched so that rapid toggling does not race. The rest
 * countdown (restTimer.ts) is deliberately NOT persisted to the file.
 */

function replaceMarkerAt(line: string, start: number, end: number, completed: boolean): string {
  const marker = completed ? "[x]" : "[ ]";
  if (start < 0 || end > line.length || start > end) {
    return line;
  }
  return line.substring(0, start) + marker + line.substring(end);
}

export async function syncSetCompletion(
  app: App,
  sourcePath: string,
  line: string,
  markerStart: number,
  markerEnd: number,
  completed: boolean
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(sourcePath);
  if (!(file instanceof TFile)) {
    return;
  }
  const newLine = replaceMarkerAt(line, markerStart, markerEnd, completed);
  if (newLine === line) {
    // No marker to update (e.g. the raw line has none).
    return;
  }
  await atomicModify(app, file, (data) => {
    // Our char offsets were computed against the trimmed-line's original
    // position in the file. Re-locate by replacing the first identical
    // occurrence of the old line to remain robust against whitespace drift.
    const idx = data.indexOf(line);
    if (idx === -1) {
      return data;
    }
    return data.substring(0, idx) + newLine + data.substring(idx + line.length);
  });
}

/**
 * P31: rewrite an exercise line in the source note after the user edits a
 * rendered card. Replaces the first occurrence of `oldLine` with `newLine`,
 * preserving the rest of the document.
 */
export async function syncLineEdit(
  app: App,
  sourcePath: string,
  oldLine: string,
  newLine: string
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(sourcePath);
  if (!(file instanceof TFile)) {
    return;
  }
  if (!oldLine || oldLine === newLine) {
    return;
  }
  // Allow newLine === "" for delete flow from Kinetic modal
  await atomicModify(app, file, (data) => {
    const idx = data.indexOf(oldLine);
    if (idx === -1) {
      return data;
    }
    return data.substring(0, idx) + newLine + data.substring(idx + oldLine.length);
  });
}
