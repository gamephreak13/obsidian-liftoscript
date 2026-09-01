import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";

/*
 * editLineModal.ts
 *
 * P31: edit the source line of a rendered workout card. Useful when a set was
 * completed with different reps/weight than planned — the header "Edit" button
 * opens this modal prefilled with the current line so the user can correct any
 * part (reps, weight, sets, rest, progress) and write it back to the note.
 */

export interface EditLineOptions {
  /** The current raw exercise line, e.g. "[ ] [x] Bench / 5x100lb, rest: 90". */
  line: string;
  /** Exercise name shown in the modal heading. */
  name: string;
  /** Called with the edited line when the user saves. */
  onSave: (newLine: string) => void | Promise<void>;
}

export class EditLineModal extends Modal {
  private readonly opts: EditLineOptions;
  private textarea: HTMLTextAreaElement | null = null;
  private saveBtn: ButtonComponent | null = null;
  private saved = false;

  constructor(app: App, opts: EditLineOptions) {
    super(app);
    this.opts = opts;
  }

  override onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.className += " liftoscript-edit-modal";

    new Setting(contentEl).setHeading().setName(this.opts.name);

    const textSetting = new Setting(contentEl)
      .setName("Exercise line")
      .setDesc(
        "Edit the sets as raw liftoscript. Each \"NxW\" token is one set; " +
          "the [ ]/[x] markers (one per set) come first. Keep the format " +
          "valid so the card still renders."
      );

    const textarea = document.createElement("textarea");
    textarea.className = "liftoscript-edit-line";
    textarea.value = this.opts.line;
    textarea.rows = Math.min(6, Math.max(2, (this.opts.line.match(/,/g)?.length || 0) + 2));
    textarea.spellcheck = false;
    textarea.addEventListener("input", () => this.updateState());
    textSetting.controlEl.empty();
    textSetting.controlEl.appendChild(textarea);
    this.textarea = textarea;

    const actions = contentEl.createDiv({ cls: "liftoscript-modal-actions" });
    new ButtonComponent(actions).setButtonText("Cancel").onClick(() => this.close());
    this.saveBtn = new ButtonComponent(actions)
      .setButtonText("Save")
      .setCta()
      .onClick(() => void this.save());
    this.saveBtn.buttonEl.disabled = true;

    textarea.focus();
    textarea.select();
  }

  private updateState(): void {
    if (!this.textarea || !this.saveBtn) {
      return;
    }
    const text = this.textarea.value.trim();
    this.saveBtn.buttonEl.disabled = !text || text === this.opts.line;
  }

  private async save(): Promise<void> {
    const text = this.textarea?.value.trim() ?? "";
    if (!text) {
      new Notice("Exercise line cannot be empty.");
      return;
    }
    this.saved = true;
    this.close();
    await this.opts.onSave(text);
  }

  override onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
