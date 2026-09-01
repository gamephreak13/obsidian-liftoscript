import { App, normalizePath, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { DATABASE_LABELS, DatabaseId } from "./exerciseDb";
import type { Unit } from "./parser";
// Re-export the shared name extractor (defined in the pure exerciseDb module)
// so existing importers keep using "./settings".
export { exerciseNameFromLine } from "./exerciseDb";

/*
 * settings.ts
 *
 * P18 + P22 + P25 + P27: plugin settings tab. Exposes:
 *   1. workoutFolder        - directory where "Generate Next Workout" writes files
 *   2. appendToDailyNote    - append the generated workout inline to the active
 *                             daily note instead of creating a separate file
 *   3. customExerciseDb     - path to a JSON file overriding/merging the active
 *                             exercise database (applied on save)
 *   4. activeExerciseDb     - dropdown choosing "Native Liftosaur" or
 *                             "Free Exercise DB" (P22)
 *   5. frontmatterTemplate  - custom YAML frontmatter template (P25/P26)
 *   6. workoutFilenameTemplate - default output filename convention (P27/P28)
 */

export interface LiftoscriptSettings {
  workoutFolder: string;
  appendToDailyNote: boolean;
  customExerciseDb: string;
  activeExerciseDb: DatabaseId;
  freeExerciseRemoteUrl: string;
  frontmatterTemplate: string;
  workoutFilenameTemplate: string;
  fabMode: "mobile" | "desktop" | "both";
  fabRestrictToFolders: boolean;
  fabFolders: string[];
  buttonTemplates: string[];
  /** User's body weight in `defaultBodyWeightUnit`, used for bodyweight volume. */
  defaultBodyWeight: number;
  defaultBodyWeightUnit: "lb" | "kg";
}

/** The default frontmatter template (P26 default, mirrors the old hardcoded YAML). */export const DEFAULT_FRONTMATTER_TEMPLATE = [
  "date: {{date}}",
  "total_volume: {{total_volume}}",
  "total_volume_unit: {{total_volume_unit}}",
  "completed_sets: {{completed_sets}}",
  "total_sets: {{total_sets}}",
  "total_reps: {{total_reps}}",
  "exercises_completed: {{exercises_completed}}",
  "session_duration: {{session_duration}}",
  "session_duration_seconds: {{session_duration_seconds}}",
  "last_updated: {{last_updated}}",
].join("\n");

/** The default output filename convention (P28). */
export const DEFAULT_FILENAME_TEMPLATE = "{{workout_name}}-{{date}}";

/** Default remote source for the "Free Exercise DB (Remote)" variant (P29). */
export const DEFAULT_FREE_DB_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

export const DEFAULT_SETTINGS: LiftoscriptSettings = {
  workoutFolder: "",
  appendToDailyNote: false,
  customExerciseDb: "",
  activeExerciseDb: "free",
  freeExerciseRemoteUrl: DEFAULT_FREE_DB_URL,
  frontmatterTemplate: DEFAULT_FRONTMATTER_TEMPLATE,
  workoutFilenameTemplate: DEFAULT_FILENAME_TEMPLATE,
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
  defaultBodyWeight: 0,
  defaultBodyWeightUnit: "lb",
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
  private readonly onRefreshRemote: () => void;

  constructor(
    app: App,
    plugin: LiftoscriptPluginLike,
    onApplyCustom: () => void,
    onGenerateExample: () => void,
    onRefreshRemote: () => void
  ) {
    super(app, plugin);
    this.plugin = () => plugin;
    this.onApplyCustom = onApplyCustom;
    this.onGenerateExample = onGenerateExample;
    this.onRefreshRemote = onRefreshRemote;
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

    new Setting(containerEl).setName("Default body weight").setDesc(
      "Your body weight, used to compute volume for bodyweight sets (e.g. " +
        "5xbw or 5xbw+25lb). Bodyweight volume = (body weight + added weight) x reps."
    ).addText((text) =>
      text
        .setPlaceholder("0")
        .setValue(String(settings.defaultBodyWeight))
        .onChange(async (value) => {
          const n = parseFloat(value);
          const plugin = this.plugin();
          plugin.settings.defaultBodyWeight = Number.isFinite(n) ? n : 0;
          await plugin.saveSettings();
        })
    ).addDropdown((dd) => {
      dd.addOption("lb", "lb");
      dd.addOption("kg", "kg");
      dd.setValue(settings.defaultBodyWeightUnit);
      dd.onChange(async (value) => {
        const plugin = this.plugin();
        plugin.settings.defaultBodyWeightUnit = value as Unit;
        await plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName("Append inline to current note").setDesc(
      "When enabled, 'Generate Next Workout' appends the generated workout " +
        "block to the active current note instead of creating a separate file."
    ).addToggle((toggle) =>
      toggle
        .setValue(settings.appendToDailyNote)
        .onChange(async (value) => {
          const plugin = this.plugin();
          plugin.settings.appendToDailyNote = value;
          await plugin.saveSettings();
        })
    );

    containerEl.createEl("h3", { text: "Exercise database" });

    new Setting(containerEl).setName("Active exercise database").setDesc(
      "Choose which dataset drives exercise autocomplete and stretch/strength " +
        "parsing. 'Native Liftosaur' uses the built-in list. 'Free Exercise DB " +
        "(Local)' uses the bundled open-source dataset (searchable by muscle " +
        "group and equipment). 'Free Exercise DB (Remote)' fetches the same " +
        "dataset live from the URL below, falling back to the bundled copy if " +
        "the fetch fails."
    ).addDropdown((dd) => {
      for (const [id, label] of Object.entries(DATABASE_LABELS) as [DatabaseId, string][]) {
        dd.addOption(id, label);
      }
      dd.setValue(settings.activeExerciseDb);
      dd.onChange(async (value) => {
        const plugin = this.plugin();
        plugin.settings.activeExerciseDb = value as DatabaseId;
        await plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName("Free Exercise DB remote URL").setDesc(
      "Source for the 'Free Exercise DB (Remote)' variant. Points at the " +
        "upstream GitHub raw dist/exercises.json by default; change it to use a " +
        "mirror or a self-hosted copy."
    ).addText((text) =>
      text
        .setPlaceholder(DEFAULT_FREE_DB_URL)
        .setValue(settings.freeExerciseRemoteUrl)
        .onChange(async (value) => {
          const plugin = this.plugin();
          plugin.settings.freeExerciseRemoteUrl = value.trim();
          await plugin.saveSettings();
        })
    );

    new Setting(containerEl).setName("Refresh remote database").setDesc(
      "Re-fetch the Free Exercise DB from the URL above now."
    ).addButton((button) =>
      button.setButtonText("Refresh").setCta().onClick(() => this.onRefreshRemote())
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

    containerEl.createEl("h3", { text: "Templates" });

    new Setting(containerEl).setName("Frontmatter template").setDesc(
      "Custom YAML frontmatter used by 'Update workout metrics in frontmatter' " +
        "and 'Generate Next Workout'. One key: value per line. Supported " +
        "variables: {{date}}, {{total_volume}}, {{total_volume_unit}}, " +
        "{{completed_sets}}, {{total_sets}}, {{total_reps}}, " +
        "{{exercises_completed}}, {{session_duration}}, " +
        "{{session_duration_seconds}}, {{last_updated}}, {{previous_workout}}, " +
        "{{workout_name}}. Leave empty for the default."
    ).addTextArea((area) =>
      area
        .setPlaceholder(DEFAULT_FRONTMATTER_TEMPLATE)
        .setValue(settings.frontmatterTemplate || DEFAULT_FRONTMATTER_TEMPLATE)
        .onChange(async (value) => {
          const plugin = this.plugin();
          plugin.settings.frontmatterTemplate = value;
          await plugin.saveSettings();
        })
    );

    new Setting(containerEl).setName("Workout filename template").setDesc(
      "Default file name for generated workout reports. Supported variables: " +
        "{{date}} (YYYY-MM-DD), {{time}} (HH-MM), {{workout_name}}. The .md " +
        "extension is appended automatically. Leave empty for the default " +
        "'{{workout_name}}-{{date}}'."
    ).addText((text) =>
      text
        .setPlaceholder(DEFAULT_FILENAME_TEMPLATE)
        .setValue(settings.workoutFilenameTemplate || DEFAULT_FILENAME_TEMPLATE)
        .onChange(async (value) => {
          const plugin = this.plugin();
          plugin.settings.workoutFilenameTemplate = value;
          await plugin.saveSettings();
        })
    );

    containerEl.createEl("h3", { text: "Credits" });

    const credits = containerEl.createEl("p", {
      cls: "liftoscript-credits",
    });
    credits.createSpan({ text: "Built on " });
    credits.createEl("a", {
      text: "Liftosaur",
      href: "https://www.liftosaur.com/",
    });
    credits.createSpan({
      text: "'s ",
    });
    credits.createEl("a", {
      text: "Liftoscript",
      href: "https://www.liftosaur.com/docs/syntax",
    });
    credits.createSpan({
      text: " scripting language. Exercise autocomplete uses the ",
    });
    credits.createEl("a", {
      text: "Free Exercise DB",
      href: "https://github.com/yuhonas/free-exercise-db",
    });
    credits.createSpan({ text: ". Thanks!" });
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
