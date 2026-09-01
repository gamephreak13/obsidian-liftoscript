import { Notice, Platform, Plugin, TFile, requestUrl, setIcon } from "obsidian";
import { setCustomExercises, setActiveDatabase, setFreeRemoteExercises } from "./exerciseDb";
import { ExerciseSuggest } from "./exerciseSuggest";
import { registerLiftoscriptPostProcessor, RenderCallbacks } from "./liftoscriptRender";
import { syncSetCompletion, syncLineEdit } from "./setCompletion";
import { updateWorkoutFrontmatter } from "./frontmatter";
import { buildNextWorkoutContent } from "./nextWorkout";
import { formatTemplateDate, formatTemplateTime, renderTemplate } from "./template";
import {
	DEFAULT_SETTINGS,
	exerciseNameFromLine,
	fabVisibleForMode,
	isInRestrictedFolders,
	LiftoscriptSettingTab,
	LiftoscriptSettings,
	parseCustomExercises,
	readVaultText,
	resolveFolder,
} from "./settings";
import { LogExerciseModal } from "./inputModal";
import { insertLineIntoLastBlock, stripFrontmatter } from "./appendLine";
import { atomicModify } from "./atomicWrite";
import { ensureExampleNote } from "./exampleNote";

export default class LiftoscriptPlugin extends Plugin {
	settings: LiftoscriptSettings;
	private fabEl: HTMLElement | null = null;
	private buttonCommandIds: string[] = [];
	/** The last remote URL we successfully fetched, to avoid duplicate fetches. */
	private fetchedRemoteUrl = "";

	async onload() {
		await this.loadSettings();
		// P20: the example note is generated on demand from the settings tab,
		// never automatically, so no file appears without the user's action.
		this.addSettingTab(new LiftoscriptSettingTab(this.app, this, () => {
			void this.applyCustomExercises();
		}, () => {
			void this.ensureExampleFile();
		}, () => {
			// P29: manual refresh of the remote Free Exercise DB.
			void this.applyRemoteDatabase(true);
		}));

		this.addRibbonIcon("dumbbell", "Log exercise", () => this.openLogModal());

		this.registerButtonCommands();

		this.registerEditorSuggest(new ExerciseSuggest(this.app));

		// P29: when the active database is the remote Free DB, fetch it on load
		// (with the bundled copy as the offline fallback).
		void this.applyRemoteDatabase(false);

		const callbacks: RenderCallbacks = {
			onSetToggled: (lineText, markerStart, markerEnd, completed, sourcePath) => {
				syncSetCompletion(this.app, sourcePath, lineText, markerStart, markerEnd, completed).catch(
					(e) => {
						console.error("Liftoscript: failed to sync set completion", e);
					}
				);
			},
			onEditLine: (oldLine, newLine, sourcePath) => {
				syncLineEdit(this.app, sourcePath, oldLine, newLine)
					.then(() => new Notice("Exercise updated."))
					.catch((e) => {
						console.error("Liftoscript: failed to edit exercise line", e);
						new Notice("Liftoscript: failed to update the exercise.");
					});
			},
			editMode: () => this.settings.exerciseEditMode,
		};

		registerLiftoscriptPostProcessor(this, callbacks);

		this.registerEvent(this.app.workspace.on("file-open", () => this.refreshFAB()));

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				menu.addItem((item) => {
					item
						.setTitle("Log exercise")
						.setIcon("dumbbell")
						.onClick(() => this.openLogModal());
				});
			})
		);

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
						await updateWorkoutFrontmatter(
							this.app,
							file,
							text,
							this.settings.frontmatterTemplate,
							{
								value: this.settings.defaultBodyWeight,
								unit: this.settings.defaultBodyWeightUnit,
							}
						);
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

		this.addCommand({
			id: "log-exercise",
			name: "Log exercise",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) {
					return false;
				}
				if (!checking) {
					const modal = new LogExerciseModal(this.app, {
						onSubmit: async (result) => {
							await this.appendExerciseLine(file, result.line);
						},
					});
					modal.open();
				}
				return true;
			},
		});
	}

	/** Append a generated liftoscript line into the active note (atomic, queued). */
	private async appendExerciseLine(file: TFile, line: string) {
		await atomicModify(this.app, file, (text) => insertLineIntoLastBlock(text, line));
		new Notice(`Logged ${line.split(" / ")[0].trim()}`);
	}

	/** Generate/refresh the example note (settings button); reports the outcome. */
	private async ensureExampleFile() {
		try {
			const outcome = await ensureExampleNote(this.app);
			const label =
				outcome === "created"
					? "Liftoscript: created the example note."
					: outcome === "refreshed"
						? "Liftoscript: refreshed the example note."
						: "Liftoscript: a note already exists at that path — left untouched.";
			new Notice(label);
		} catch (e) {
			console.error("Liftoscript: failed to generate example note", e);
			new Notice("Liftoscript: failed to generate the example note.");
		}
	}

	private async generateNextWorkout(previous: TFile) {
		const previousText = await this.app.vault.cachedRead(previous);
		const baseName = previous.basename.replace(/-\d{4}-\d{2}-\d{2}$/, "") || "Workout";

		const content = buildNextWorkoutContent({
			previousPath: previous.path,
			previousText,
			previousTitle: previous.basename,
			frontmatterTemplate: this.settings.frontmatterTemplate,
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
				await atomicModify(this.app, active, (existing) =>
					existing.replace(/\s*$/, "") + "\n\n" + body + "\n"
				);
				new Notice(`Appended workout to ${active.name}`);
			} else {
				new Notice("No active note to append to; creating a file instead.");
				await this.createWorkoutFile(folder, baseName, content);
			}
			return;
		}

		await this.createWorkoutFile(folder, baseName, content);
	}

	private async createWorkoutFile(
		folder: string,
		baseName: string,
		content: string
	) {
		const dir = folder.trim();
		// If a workout folder is configured but doesn't exist yet, create it
		// (and any missing parents) before writing, so a new vault / fresh
		// settings path never fails the write.
		if (dir) {
			await this.ensureFolderExists(this.app.vault, dir);
		}
		const prefix = dir ? `${dir}/` : "";

		// P28: render the output filename from the configured convention
		// (settings.workoutFilenameTemplate), then ensure a unique name.
		const template = (this.settings.workoutFilenameTemplate || "").trim()
			|| "{{workout_name}}-{{date}}";
		const stem = this.renderFilenameTemplate(template, baseName);

		let filename = `${stem}.md`;
		let counter = 2;
		while (this.app.vault.getAbstractFileByPath(prefix + filename)) {
			filename = `${stem}-${counter}.md`;
			counter += 1;
		}

		const newFile = await this.app.vault.create(prefix + filename, content);

		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(newFile);
		new Notice(`Created ${newFile.name}`);
	}

	/**
	 * Recursively create a vault folder (and any missing parents) if absent.
	 * Uses createFolder per level so a nested, not-yet-existing path like
	 * "Fitness/Reports/2026" is created in full before a file is written into it.
	 */
	private async ensureFolderExists(
		vault: import("obsidian").Vault,
		folder: string
	): Promise<void> {
		const clean = folder.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
		let partial = "";
		for (const segment of clean) {
			partial = partial ? `${partial}/${segment}` : segment;
			if (vault.getAbstractFileByPath(partial)) {
				continue;
			}
			await vault.createFolder(partial);
		}
	}

	/** Substitute {{date}}, {{time}}, {{workout_name}} into the filename stem. */
	private renderFilenameTemplate(template: string, workoutName: string): string {
		const now = new Date();
		const stem = renderTemplate(template, {
			date: formatTemplateDate(now),
			time: formatTemplateTime(now),
			workout_name: workoutName,
		})
			.trim()
			.replace(/[\\/:*?"<>|]+/g, "-")
			.replace(/\s+/g, " ")
			.replace(/^-+|-+$/g, "");
		// A template with no variables (or all removed) must still be unique.
		return stem || `${workoutName}-${formatTemplateDate(now)}`;
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// P22: keep the active exercise database in sync with the setting.
		setActiveDatabase(this.settings.activeExerciseDb);
		// P29: refetch the remote Free DB when switching to it or changing the URL.
		const remoteUrl = (this.settings.freeExerciseRemoteUrl || "").trim();
		if (
			this.settings.activeExerciseDb === "free-remote" &&
			remoteUrl &&
			remoteUrl !== this.fetchedRemoteUrl
		) {
			void this.applyRemoteDatabase(false);
		}
		this.refreshFAB();
		this.registerButtonCommands();
	}

	private async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// P22: apply the active exercise database choice.
		setActiveDatabase(this.settings.activeExerciseDb);
		this.refreshFAB();
	}

	private openLogModal() {
		const file = this.app.workspace.getActiveFile();
		if (!(file instanceof TFile)) {
			new Notice("Open a note to log an exercise.");
			return;
		}
		const modal = new LogExerciseModal(this.app, {
			onSubmit: async (result) => {
				await this.appendExerciseLine(file, result.line);
			},
		});
		modal.open();
	}

	/**
	 * P15: render a floating action button on the workspace container when the
	 * configured fabMode matches the current platform. Tap opens the log modal.
	 */
	private refreshFAB() {
		const target = this.app.workspace.containerEl;
		const visible =
			fabVisibleForMode(this.settings.fabMode, Platform.isMobile) &&
			this.fabAllowedInActiveNote();

		this.fabEl?.remove();
		this.fabEl = null;
		if (!visible) {
			return;
		}

		const fab = document.createElement("button");
		fab.type = "button";
		fab.className = `liftoscript-fab liftoscript-fab-${this.settings.fabPosition}`;
		fab.setAttribute("aria-label", "Log exercise");
		fab.setAttribute("title", "Log exercise");
		const icon = fab.createDiv({ cls: "liftoscript-fab-icon" });
		setIcon(icon, "dumbbell");
		const label = fab.createDiv({ cls: "liftoscript-fab-label" });
		label.textContent = "Log";
		fab.addEventListener("click", () => this.openLogModal());
		target.appendChild(fab);
		this.fabEl = fab;
	}

	private fabAllowedInActiveNote(): boolean {
		if (!this.settings.fabRestrictToFolders) {
			return true;
		}
		const file = this.app.workspace.getActiveFile();
		if (!(file instanceof TFile)) {
			return false;
		}
		return isInRestrictedFolders(file.path, this.settings.fabFolders);
	}

	private registerButtonCommands() {
		for (const id of this.buttonCommandIds) {
			this.removeCommand(id);
		}
		this.buttonCommandIds = [];

		const seen = new Set<string>();
		for (const line of this.settings.buttonTemplates) {
			const name = exerciseNameFromLine(line);
			if (!name || seen.has(name.toLowerCase())) {
				continue;
			}
			seen.add(name.toLowerCase());
			const id = `liftoscript-add-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
			this.addCommand({
				id,
				name: `Add ${name}`,
				checkCallback: (checking) => {
					const file = this.app.workspace.getActiveFile();
					if (!(file instanceof TFile)) {
						return false;
					}
					if (!checking) {
						void this.appendExerciseLine(file, line);
					}
					return true;
				},
			});
			this.buttonCommandIds.push(id);
		}
	}

	onunload() {
		this.fabEl?.remove();
		this.fabEl = null;
		for (const id of this.buttonCommandIds) {
			this.removeCommand(id);
		}
		this.buttonCommandIds = [];
	}

	/**
	 * P29: fetch the Free Exercise DB from the configured remote URL. On success
	 * the normalized records are stored and drive the "free-remote" mode; on any
	 * failure (offline, 404, bad JSON) we clear the remote store so lookups fall
	 * back to the bundled local copy. `notify` shows a confirmation Notice (used
	 * by the manual Refresh button), while quiet startup fetches stay silent.
	 */
	async applyRemoteDatabase(notify: boolean): Promise<void> {
		const url = (this.settings.freeExerciseRemoteUrl || "").trim();
		if (!url) {
			if (notify) {
				new Notice("Free Exercise DB: remote URL is empty.");
			}
			return;
		}
		try {
			const res = await requestUrl({ url });
			const parsed: unknown = JSON.parse(res.text);
			const arr: unknown =
				Array.isArray(parsed) ? parsed : (parsed as { exercises?: unknown } | null)?.exercises;
			if (!Array.isArray(arr)) {
				throw new Error("response is not an exercise array");
			}
			setFreeRemoteExercises(arr as Array<Record<string, unknown>>);
			this.fetchedRemoteUrl = url;
			if (notify) {
				new Notice(`Free Exercise DB: loaded ${arr.length} exercises from remote.`);
			} else {
				console.info(`Liftoscript: loaded ${arr.length} exercises from remote Free DB`);
			}
		} catch (e) {
			setFreeRemoteExercises([]);
			console.warn("Liftoscript: remote Free DB fetch failed, using bundled copy", e);
			if (notify) {
				new Notice("Free Exercise DB: remote fetch failed — using the bundled copy.");
			}
		}
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
}

