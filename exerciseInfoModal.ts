import { App, Modal, Setting } from "obsidian";
import { Exercise, exerciseImageUrl } from "./exerciseDb";

/*
 * exerciseInfoModal.ts
 *
 * P30: a modal showing Free Exercise DB details for a matched exercise —
 * equipment, primary/secondary muscles, step-by-step instructions, and the
 * exercise images loaded dynamically from the yuhonas/free-exercise-db GitHub
 * raw asset host.
 */

const FREE_GITHUB = "https://github.com/yuhonas/free-exercise-db";

/** Titles the image (strips the leading "<id>/..." path and extension). */
function imageLabel(exercise: Exercise, index: number): string {
  const rel = exercise.images?.[index] ?? "";
  const leaf = rel.split("/").pop() ?? `${index + 1}`;
  const base = leaf.replace(/\.[a-z0-9]+$/i, "");
  return `${exercise.name} — view ${base}`;
}

export class ExerciseInfoModal extends Modal {
  private readonly exercise: Exercise;
  private imgIndex = 0;

  constructor(app: App, exercise: Exercise) {
    super(app);
    this.exercise = exercise;
  }

  override onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.className += " liftoscript-info-modal";

    contentEl.createEl("h2", { text: this.exercise.name });

    const meta = contentEl.createDiv({ cls: "liftoscript-info-meta" });

    const eq = this.exercise.equipment?.trim();
    if (eq) {
      new Setting(meta).setName("Equipment").setDesc(eq);
    }

    const primaries = this.exercise.primaryMuscles ?? [];
    const secondaries = this.exercise.secondaryMuscles ?? [];
    if (primaries.length || secondaries.length) {
      new Setting(meta).setName("Muscles").setDesc([
        ...(primaries.length ? [`Primary: ${primaries.join(", ")}`] : []),
        ...(secondaries.length ? [`Secondary: ${secondaries.join(", ")}`] : []),
      ].join("  ·  "));
    }

    const images = this.exercise.images ?? [];
    if (images.length) {
      this.renderImageCarousel(contentEl);
    } else if (this.exercise.images === undefined) {
      // No image metadata; nothing to show. (Images always exist for Free DB.)
    }

    const instructions = this.exercise.instructions ?? [];
    if (instructions.length) {
      contentEl.createDiv({ cls: "liftoscript-info-section", text: "Instructions" });
      const ol = contentEl.createEl("ol", { cls: "liftoscript-info-steps" });
      instructions.forEach((step) => ol.createEl("li", { text: step }));
    }

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("View on GitHub")
        .onClick(() => window.open(FREE_GITHUB, "_blank"))
    ).addButton((btn) =>
      btn
        .setButtonText("Close")
        .setCta()
        .onClick(() => this.close())
    );
  }

  private renderImageCarousel(parent: HTMLElement): void {
    const images = this.exercise.images ?? [];
    const wrap = parent.createDiv({ cls: "liftoscript-info-images" });
    const img = wrap.createEl("img", {
      cls: "liftoscript-info-image",
    });
    const caption = wrap.createDiv({ cls: "liftoscript-info-caption" });

    const show = (index: number) => {
      this.imgIndex = ((index % images.length) + images.length) % images.length;
      img.src = exerciseImageUrl(this.exercise, this.imgIndex);
      caption.setText(`${this.imgIndex + 1} / ${images.length}`);
      img.alt = imageLabel(this.exercise, this.imgIndex);
    };

    if (images.length > 1) {
      const controls = wrap.createDiv({ cls: "liftoscript-info-controls" });
      controls.createEl("button", { text: "‹", cls: "liftoscript-info-prev" })
        .addEventListener("click", (e) => { e.preventDefault(); show(this.imgIndex - 1); });
      controls.createEl("button", { text: "›", cls: "liftoscript-info-next" })
        .addEventListener("click", (e) => { e.preventDefault(); show(this.imgIndex + 1); });
    }

    show(0);
  }

  override onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
