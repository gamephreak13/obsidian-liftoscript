import { Notice, Plugin, TFile } from "obsidian";
import { ExerciseSuggest, setCustomExercises } from "./exerciseDb";
import { registerLiftoscriptPostProcessor, RenderCallbacks } from "./liftoscriptRender";
import { syncSetCompletion } from "./setCompletion";
import { updateWorkoutFrontmatter } from "./frontmatter";
import { buildNextWorkoutContent } from "./nextWorkout";
import {
	DEFAULT_SETTINGS,
	LiftoscriptSettingTab,
	LiftoscriptSettings,
	parseCustomExercises,
	readVaultText,
	resolveFolder,
} from "./settings";

export default class LiftoscriptPlugin extends Plugin {
	settings: LiftoscriptSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new LiftoscriptSettingTab(this.app, this, () => {
			void this.applyCustomExercises();
		}));

		this.registerEditorSuggest(new ExerciseSuggest(this.app));

		const callbacks: RenderCallbacks = {
			onSetToggled: (lineText, markerStart, markerEnd, completed, sourcePath) => {
				syncSetCompletion(this.app, sourcePath, lineText, markerStart, markerEnd, completed).catch(
					(e) => {
						console.error("Liftoscript: failed to sync set completion", e);
					}
				);
			},
		};

		registerLiftoscriptPostProcessor(this, callbacks);

		this.addCommand({
			id: "update-workout-metrics",
			name: "Update workout metrics in frontmatter",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) {
					return false;
				}
				if (!checking) {
					this.app.vault.cachedRead(file).then(async (text) => {
						await updateWorkoutFrontmatter(this.app, file, text);
						new Notice("Workout metrics updated.");
					});
				}
				return true;
			},
		});

		this.addCommand({
			id: "generate-next-workout",
			name: "Generate Next Workout",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) {
					return false;
				}
				if (!checking) {
					void this.generateNextWorkout(file);
				}
				return true;
			},
		});
	}

	private async generateNextWorkout(previous: TFile) {
		const previousText = await this.app.vault.cachedRead(previous);
		const date = new Date().toISOString().slice(0, 10);
		const baseName = previous.basename.replace(/-\d{4}-\d{2}-\d{2}$/, "") || "Workout";

		const content = buildNextWorkoutContent({
			previousPath: previous.path,
			previousText,
			previousTitle: previous.basename,
		});

		// P18: honor the configured workout folder ("" == the active note's folder).
		const folder =
			resolveFolder(this.settings.workoutFolder) ||
			(previous.parent?.path ?? "");

		// P18: optionally append inline to the active note instead of a new file.
		if (this.settings.appendToDailyNote) {
			const active = this.app.workspace.getActiveFile();
			if (active instanceof TFile) {
				const body = stripFrontmatter(content);
				const existing = await this.app.vault.cachedRead(active);
				const appended = existing.replace(/\s*$/, "") + "\n\n" + body + "\n";
				await this.app.vault.modify(active, appended);
				new Notice(`Appended workout to ${active.name}`);
			} else {
				new Notice("No active note to append to; creating a file instead.");
				await this.createWorkoutFile(folder, baseName, date, content);
			}
			return;
		}

		await this.createWorkoutFile(folder, baseName, date, content);
	}

	private async createWorkoutFile(
		folder: string,
		baseName: string,
		date: string,
		content: string
	) {
		const dir = folder.trim();
		const prefix = dir ? `${dir}/` : "";

		let filename = `${baseName}-${date}.md`;
		let counter = 2;
		while (this.app.vault.getAbstractFileByPath(prefix + filename)) {
			filename = `${baseName}-${date}-${counter}.md`;
			counter += 1;
		}

		const newFile = await this.app.vault.create(prefix + filename, content);

		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(newFile);
		new Notice(`Created ${newFile.name}`);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/** Load + merge the configured custom exercise database (P18 option 3). */
	async applyCustomExercises() {
		const path = (this.settings.customExerciseDb || "").trim();
		if (!path) {
			setCustomExercises([]);
			new Notice("Using the default exercise database.");
			return;
		}
		const text = await readVaultText(this.app, path);
		if (text == null) {
			new Notice(`Custom exercise database not found: ${path}`);
			return;
		}
		try {
			const exercises = parseCustomExercises(text);
			setCustomExercises(exercises);
			new Notice(`Applied ${exercises.length} custom exercise(s) from ${path}`);
		} catch (e) {
			new Notice(`Failed to apply custom database: ${(e as Error).message}`);
		}
	}

	onunload() {}
}

/** Remove leading YAML frontmatter from a note's body for inline appends. */
function stripFrontmatter(content: string): string {
	const m = content.match(/^---\n[\s\S]*?\n---\n?/);
	return m ? content.slice(m[0].length) : content;
}
