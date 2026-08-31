import { App, normalizePath, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";

/*
 * settings.ts
 *
 * P18: plugin settings tab. Exposes three configuration options:
 *   1. workoutFolder      - directory where "Generate Next Workout" writes files
 *   2. appendToDailyNote  - append the generated workout inline to the active
 *                           daily note instead of creating a separate file
 *   3. customExerciseDb   - path to a JSON file overriding/merging the default
 *                           Liftosaur exercise database (applied on save)
 */

export interface LiftoscriptSettings {
  workoutFolder: string;
  appendToDailyNote: boolean;
  customExerciseDb: string;
}

export const DEFAULT_SETTINGS: LiftoscriptSettings = {
  workoutFolder: "",
  appendToDailyNote: false,
  customExerciseDb: "",
};

/** Normalize a configured folder to a vault-relative path ("" == vault root). */
export function resolveFolder(folder: string): string {
  const p = normalizePath((folder || "").trim());
  if (p === "." || p === "" || p === "/") {
    return "";
  }
  return p.replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Parse a custom exercise database file body. Accepts either a bare array of
 * exercise objects or an object with an "exercises" array. The returned arrays
 * let callers decide whether to override (replace) or append/merge.
 */
export function parseCustomExercises(
  text: string
): Array<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }
  let arr: unknown = parsed;
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === "object") {
    const maybe = (parsed as Record<string, unknown>).exercises;
    if (Array.isArray(maybe)) {
      arr = maybe;
    }
  }
  if (!Array.isArray(arr)) {
    throw new Error('Expected an array of exercises or { "exercises": [...] }');
  }
  return arr.filter(
    (e): e is Record<string, unknown> =>
      e != null &&
      typeof e === "object" &&
      typeof (e as Record<string, unknown>).name === "string"
  );
}

/** Interface the settings tab's plugin must satisfy. */
export interface LiftoscriptPluginLike extends Plugin {
  settings: LiftoscriptSettings;
  saveSettings(): Promise<void>;
}

export class LiftoscriptSettingTab extends PluginSettingTab {
  private readonly plugin: () => LiftoscriptPluginLike;
  private readonly onApplyCustom: () => void;

  constructor(
    app: App,
    plugin: LiftoscriptPluginLike,
    onApplyCustom: () => void
  ) {
    super(app, plugin);
    this.plugin = () => plugin;
    this.onApplyCustom = onApplyCustom;
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const settings = this.plugin().settings;

    new Setting(containerEl).setName("Workout folder").setDesc(
      "Directory (relative to the vault) where generated workout files are saved. " +
        "Leave empty to use the active note's folder."
    ).addText((text) =>
      text
        .setPlaceholder("Fitness/Reports")
        .setValue(settings.workoutFolder)
        .onChange(async (value) => {
          const plugin = this.plugin();
          plugin.settings.workoutFolder = value.trim();
          await plugin.saveSettings();
        })
    );

    new Setting(containerEl).setName("Append inline to daily note").setDesc(
      "When enabled, 'Generate Next Workout' appends the generated workout " +
        "block to the active daily note instead of creating a separate file."
    ).addToggle((toggle) =>
      toggle
        .setValue(settings.appendToDailyNote)
        .onChange(async (value) => {
          const plugin = this.plugin();
          plugin.settings.appendToDailyNote = value;
          await plugin.saveSettings();
        })
    );

    new Setting(containerEl).setName("Custom exercise database").setDesc(
      "Path (relative to the vault) to a JSON file that overrides or appends to " +
        "the default Liftosaur exercise list. Accepts an array of exercises or " +
        "{ \"exercises\": [...] }. Changing this requires a plugin reload."
    ).addText((text) =>
      text
        .setPlaceholder("Fitness/exercises.json")
        .setValue(settings.customExerciseDb)
        .onChange(async (value) => {
          const plugin = this.plugin();
          plugin.settings.customExerciseDb = value.trim();
          await plugin.saveSettings();
        })
    );

    new Setting(containerEl).setName("Apply custom database").setDesc(
      "Load and merge the configured custom exercise database now."
    ).addButton((button) =>
      button.setButtonText("Apply").setCta().onClick(() => this.onApplyCustom())
    );
  }
}

/** Read a vault-relative text file, returning null if missing or not a file. */
export async function readVaultText(app: App, path: string): Promise<string | null> {
  const abs = normalizePath((path || "").trim());
  if (!abs) {
    return null;
  }
  const entry = app.vault.getAbstractFileByPath(abs);
  return entry instanceof TFile ? app.vault.cachedRead(entry) : null;
}
