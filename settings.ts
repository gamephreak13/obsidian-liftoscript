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
  fabMode: "mobile" | "desktop" | "both";
  fabRestrictToFolders: boolean;
  fabFolders: string[];
  buttonTemplates: string[];
}

export const DEFAULT_SETTINGS: LiftoscriptSettings = {
  workoutFolder: "",
  appendToDailyNote: false,
  customExerciseDb: "",
  fabMode: "mobile",
  fabRestrictToFolders: false,
  fabFolders: [],
  buttonTemplates: [
    "[ ] [ ] [ ] Squat / 5x200lb, 5x200lb, 5x200lb, rest: 120",
    "[ ] [ ] [ ] Bench Press / 5x100lb, 5x100lb, 5x100lb, rest: 90",
    "[ ] [ ] [ ] Deadlift / 5x200lb, 5x200lb, 5x200lb, rest: 120",
    "[ ] [ ] [ ] Overhead Press / 5x65lb, 5x65lb, 5x65lb, rest: 90",
    "[ ] [ ] [ ] Hamstring Stretch / 3x60s",
  ],
};

/**
 * Manifest id. Obsidian fully-qualifies command ids as `<this>:<commandId>`,
 * and Meta Bind buttons call `executeCommandById` with that full id, so they
 * must reference `obsidian-liftoscript:liftoscript-add-<slug>` (never bare).
 */
export const BUTTON_COMMAND_PREFIX = "obsidian-liftoscript";

/** Whether the FAB should render on the current platform for the given mode. */
export function fabVisibleForMode(mode: LiftoscriptSettings["fabMode"], isMobile: boolean): boolean {
  if (mode === "both") {
    return true;
  }
  if (mode === "mobile") {
    return isMobile;
  }
  if (mode === "desktop") {
    return !isMobile;
  }
  return false;
}

export function isInRestrictedFolders(
  notePath: string,
  folders: string[]
): boolean {
  if (!folders || folders.length === 0) {
    return true;
  }
  const normalized = normalizePath(notePath || "")
    .replace(/\/+$/, "")
    .split("/");
  for (const raw of folders) {
    const folder = normalizePath((raw || "").trim())
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);
    if (folder.length === 0) {
      return true;
    }
    let match = true;
    if (folder.length > normalized.length) {
      match = false;
    } else {
      for (let i = 0; i < folder.length; i++) {
        if (folder[i].toLowerCase() !== normalized[i].toLowerCase()) {
          match = false;
          break;
        }
      }
    }
    if (match) {
      return true;
    }
  }
  return false;
}

/** Normalize a configured folder to a vault-relative path ("" == vault root). */
export function resolveFolder(folder: string): string {
  const p = normalizePath((folder || "").trim());
  if (p === "." || p === "" || p === "/") {
    return "";
  }
  return p.replace(/^\/+/, "").replace(/\/+$/, "");
}

export function exerciseNameFromLine(line: string): string {
  const trimmed = line.trim();
  const afterMarkers = trimmed.replace(/^(\[[ xX]\]\s*)+/, "").trim();
  return afterMarkers.split("/")[0].trim();
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
  private readonly onGenerateExample: () => void;

  constructor(
    app: App,
    plugin: LiftoscriptPluginLike,
    onApplyCustom: () => void,
    onGenerateExample: () => void
  ) {
    super(app, plugin);
    this.plugin = () => plugin;
    this.onApplyCustom = onApplyCustom;
    this.onGenerateExample = onGenerateExample;
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

    containerEl.createEl("h3", { text: "Example note" });

    new Setting(containerEl).setName("Generate example note").setDesc(
      "Creates (or refreshes) a Liftosaur-Example.md that demonstrates the " +
        "plugin. Nothing is written until you click this button, and an " +
        "existing generated copy is updated in place."
    ).addButton((button) =>
      button.setButtonText("Generate").setCta().onClick(() => this.onGenerateExample())
    );

    containerEl.createEl("h3", { text: "Quick entry" });

    new Setting(containerEl).setName("Floating action button").setDesc(
      "A quick-entry FAB that opens the Log exercise modal. Choose which " +
        "platforms should show it."
    ).addDropdown((dd) => {
      dd.addOption("mobile", "Mobile Only");
      dd.addOption("desktop", "Desktop Only");
      dd.addOption("both", "Both");
      dd.setValue(settings.fabMode);
      dd.onChange(async (value) => {
        const v = value as LiftoscriptSettings["fabMode"];
        const plugin = this.plugin();
        plugin.settings.fabMode = v;
        await plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName("Restrict FAB to folders").setDesc(
      "When enabled, the FAB only appears while a note inside one of the " +
        "listed folders is active."
    ).addToggle((toggle) =>
      toggle
        .setValue(settings.fabRestrictToFolders)
        .onChange(async (value) => {
          const plugin = this.plugin();
          plugin.settings.fabRestrictToFolders = value;
          await plugin.saveSettings();
        })
    );

    new Setting(containerEl).setName("FAB folders").setDesc(
      "One folder path per line (vault-relative). Leave empty to allow the FAB " +
        "in every folder. Nested folders are included."
    ).addTextArea((area) =>
      area
        .setPlaceholder("Fitness\nWorkouts")
        .setValue(settings.fabFolders.join("\n"))
        .onChange(async (value) => {
          const plugin = this.plugin();
          plugin.settings.fabFolders = value
            .split("\n")
            .map((p) => p.trim())
            .filter(Boolean);
          await plugin.saveSettings();
        })
    );

    containerEl.createEl("h3", { text: "Meta Bind integration" });

    new Setting(containerEl).setName("Quick-add exercise templates").setDesc(
      "One liftoscript line per template. Each becomes a command named " +
        "\"Liftoscript: Add <exercise>\" (id obsidian-liftoscript:liftoscript-add-<slug>), " +
        "which a ```meta-bind-button block invokes via \"type: command\" with that full id. " +
        "Changes apply after a plugin reload."
    ).addTextArea((area) =>
      area
        .setPlaceholder("[ ] [ ] [ ] Squat / 5x200lb, rest: 120")
        .setValue(settings.buttonTemplates.join("\n"))
        .onChange(async (value) => {
          const plugin = this.plugin();
          plugin.settings.buttonTemplates = value
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          await plugin.saveSettings();
        })
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
