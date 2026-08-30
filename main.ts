import { Notice, Plugin, TFile } from "obsidian";
import { ExerciseSuggest } from "./exerciseDb";
import { registerLiftoscriptPostProcessor, RenderCallbacks } from "./liftoscriptRender";
import { syncSetCompletion } from "./setCompletion";
import { updateWorkoutFrontmatter } from "./frontmatter";
import { buildNextWorkoutContent } from "./nextWorkout";

export default class LiftoscriptPlugin extends Plugin {
	async onload() {
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
		const folder = previous.parent?.path ?? "/";
		const date = new Date().toISOString().slice(0, 10);
		const baseName = previous.basename.replace(/-\d{4}-\d{2}-\d{2}$/, "") || "Workout";

		let filename = `${baseName}-${date}.md`;
		let counter = 2;
		while (this.app.vault.getAbstractFileByPath(
			folder === "/" ? filename : `${folder}/${filename}`
		)) {
			filename = `${baseName}-${date}-${counter}.md`;
			counter += 1;
		}

		const content = buildNextWorkoutContent({
			previousPath: previous.path,
			previousText,
			previousTitle: previous.basename,
		});

		const targetPath = folder === "/" ? filename : `${folder}/${filename}`;
		const newFile = await this.app.vault.create(targetPath, content);

		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(newFile);
		new Notice(`Created ${newFile.name}`);
	}

	onunload() {}
}
