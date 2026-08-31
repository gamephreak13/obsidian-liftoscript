import {
  App,
  ButtonComponent,
  DropdownComponent,
  Modal,
  Notice,
  Setting,
  TextComponent,
} from "obsidian";
import { getExercises } from "./exerciseDb";

/*
 * inputModal.ts
 *
 * P14: a touch-optimized modal for logging a single exercise. Every field is a
 * large quick-tap control (steppers + native dropdown) so a set can be added
 * fast on mobile. On submit it emits one liftoscript line and calls the
 * callback (the caller appends it to the active note / inserts at the cursor).
 */

export interface LogExerciseResult {
  /** The emitted liftoscript line, e.g. "[ ] [ ] Squat / 5x100lb, rest: 90". */
  line: string;
  name: string;
  isStretch: boolean;
}

export interface InputModalOptions {
  onSubmit: (result: LogExerciseResult) => void | Promise<void>;
  /** Default exercise name selected when the modal opens (optional). */
  initialName?: string;
}

type Kind = "strength" | "stretch";

/** A +/- stepper with large touch targets. */
class Stepper {
  el: HTMLDivElement;
  private valueEl: HTMLSpanElement;
  private value: number;
  private readonly step: number;
  private readonly min: number;
  private readonly max: number;
  private readonly onChange: (v: number) => void;

  constructor(
    opts: {
      initial: number;
      step: number;
      min: number;
      max: number;
      label: string;
      onChange: (v: number) => void;
    }
  ) {
    this.value = opts.initial;
    this.step = opts.step;
    this.min = opts.min;
    this.max = opts.max;
    this.onChange = opts.onChange;

    this.el = document.createElement("div");
    this.el.className = "liftoscript-stepper";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "liftoscript-stepper-btn";
    minus.textContent = "−";
    minus.addEventListener("click", () => this.decrement());

    const labelEl = document.createElement("div");
    labelEl.className = "liftoscript-stepper-label";
    labelEl.textContent = opts.label;

    this.valueEl = document.createElement("span");
    this.valueEl.className = "liftoscript-stepper-value";
    this.valueEl.textContent = String(this.value);

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "liftoscript-stepper-btn liftoscript-stepper-btn-plus";
    plus.textContent = "+";
    plus.addEventListener("click", () => this.increment());

    this.el.append(minus, labelEl, this.valueEl, plus);
  }

  getValue(): number {
    return this.value;
  }

  setValue(v: number): void {
    this.value = Math.min(this.max, Math.max(this.min, v));
    this.valueEl.textContent = String(this.value);
  }

  private increment(): void {
    this.setValue(Math.round((this.value + this.step) * 100) / 100);
    this.onChange(this.value);
  }

  private decrement(): void {
    this.setValue(Math.round((this.value - this.step) * 100) / 100);
    this.onChange(this.value);
  }
}

export class LogExerciseModal extends Modal {
  private readonly opts: InputModalOptions;
  private nameDropdown: DropdownComponent | null = null;
  private customName: TextComponent | null = null;
  private kindDropdown: DropdownComponent | null = null;
  private sets: Stepper | null = null;
  private reps: Stepper | null = null;
  private weight: Stepper | null = null;
  private weightUnit: DropdownComponent | null = null;
  private hold: Stepper | null = null;
  private stretchRest: Stepper | null = null;
  private rest: Stepper | null = null;
  private strengthFields: HTMLDivElement | null = null;
  private stretchFields: HTMLDivElement | null = null;

  constructor(app: App, opts: InputModalOptions) {
    super(app);
    this.opts = opts;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.className += " liftoscript-modal";

    new Setting(contentEl).setName("Exercise").setHeading();

    // Exercise name: a native dropdown of built-in exercises plus an optional
    // custom-name text field (larger, tap-friendly).
    const nameSetting = new Setting(contentEl)
      .setName("Name")
      .setDesc("Pick from the list or type a custom name below.");
    nameSetting.addDropdown((dd) => {
      this.nameDropdown = dd;
      const exercises = getExercises();
      const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name));
      dd.addOption("", "— Select exercise —");
      sorted.forEach((e) => dd.addOption(e.name, e.name));
      if (this.opts.initialName) {
        const exact = sorted.some((e) => e.name.toLowerCase() === (this.opts.initialName as string).toLowerCase());
        if (exact) {
          dd.setValue(this.opts.initialName);
        }
      }
      dd.selectEl.addClass("liftoscript-touch");
    });

    new Setting(contentEl).setName("Custom name").setDesc(
      "Optional. If set, this overrides the dropdown selection."
    ).addText((text) => {
      this.customName = text;
      text.inputEl.addClass("liftoscript-touch");
      return text;
    });

    const kindSetting = new Setting(contentEl).setName("Type");
    kindSetting.addDropdown((dd) => {
      this.kindDropdown = dd;
      dd.addOption("strength", "Strength (weighted sets)");
      dd.addOption("stretch", "Stretch (timed hold)");
      dd.onChange(() => this.refreshLayout());
    });

    // Strength fields
    this.strengthFields = contentEl.createDiv({ cls: "liftoscript-modal-fields" });
    this.sets = new Stepper({
      initial: 3, step: 1, min: 1, max: 12, label: "Sets",
      onChange: () => {},
    });
    this.strengthFields.appendChild(this.sets.el);
    this.reps = new Stepper({
      initial: 5, step: 1, min: 0, max: 30, label: "Reps",
      onChange: () => {},
    });
    this.strengthFields.appendChild(this.reps.el);

    const weightSetting = new Setting(this.strengthFields).setName("Weight");
    this.weight = new Stepper({
      initial: 100, step: 5, min: 0, max: 1000, label: "Weight",
      onChange: () => {},
    });
    weightSetting.controlEl.appendChild(this.weight.el);
    weightSetting.addDropdown((dd) => {
      this.weightUnit = dd;
      dd.addOption("lb", "lb");
      dd.addOption("kg", "kg");
      dd.selectEl.addClass("liftoscript-touch");
    });

    const restSetting = new Setting(this.strengthFields).setName("Rest (s)");
    this.rest = new Stepper({
      initial: 90, step: 15, min: 0, max: 600, label: "Rest",
      onChange: () => {},
    });
    restSetting.controlEl.appendChild(this.rest.el);

    // Stretch fields
    this.stretchFields = contentEl.createDiv({ cls: "liftoscript-modal-fields" });
    this.hold = new Stepper({
      initial: 45, step: 5, min: 5, max: 300, label: "Hold (s)",
      onChange: () => {},
    });
    this.stretchFields.appendChild(this.hold.el);
    this.stretchRest = new Stepper({
      initial: 15, step: 5, min: 0, max: 300, label: "Rest (s)",
      onChange: () => {},
    });
    this.stretchFields.appendChild(this.stretchRest.el);

    this.refreshLayout();

    const actions = contentEl.createDiv({ cls: "liftoscript-modal-actions" });
    new ButtonComponent(actions).setButtonText("Cancel").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText("Add").setCta().onClick(async () => {
      const result = this.buildResult();
      if (!result) {
        return;
      }
      this.close();
      await this.opts.onSubmit(result);
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  /** Show/hide fields based on the selected strength vs stretch type. */
  private refreshLayout(): void {
    const kind = (this.kindDropdown?.getValue() as Kind) ?? "strength";
    if (this.strengthFields) {
      this.strengthFields.style.display = kind === "strength" ? "" : "none";
    }
    if (this.stretchFields) {
      this.stretchFields.style.display = kind === "stretch" ? "" : "none";
    }
  }

  private resolveName(): string {
    const custom = this.customName?.getValue()?.trim() ?? "";
    if (custom) {
      return custom;
    }
    return this.nameDropdown?.getValue()?.trim() ?? "";
  }

  /** Build the log line, or null if invalid (name missing). */
  private buildResult(): LogExerciseResult | null {
    const name = this.resolveName();
    if (!name) {
      new Notice("Enter an exercise name.");
      return null;
    }
    const kind = (this.kindDropdown?.getValue() as Kind) ?? "strength";

    if (kind === "stretch") {
      const sets = this.sets?.getValue() ?? 3;
      const hold = this.hold?.getValue() ?? 45;
      const rest = this.stretchRest?.getValue() ?? 15;
      const markers = Array(sets).fill("[ ]").join(" ");
      // Use a per-set rest via "hold|rest" when rest > 0, else a plain hold.
      const spec = rest > 0 ? `${sets}x${hold}s|${rest}s` : `${sets}x${hold}s`;
      const tag = isStretchName(name) ? "" : ", type: stretch";
      return {
        line: `${markers} ${name} / ${spec}${tag}`,
        name,
        isStretch: true,
      };
    }

    const sets = this.sets?.getValue() ?? 3;
    const reps = this.reps?.getValue() ?? 5;
    const weight = this.weight?.getValue() ?? 0;
    const unit = this.weightUnit?.getValue() ?? "lb";
    const rest = this.rest?.getValue() ?? 90;
    const markers = Array(sets).fill("[ ]").join(" ");
    const tokens = Array(sets).fill(`${reps}x${weight}${unit}`).join(", ");
    const line =
      `${markers} ${name} / ${tokens}` +
      (rest > 0 ? `, rest: ${rest}` : "");
    return { line, name, isStretch: false };
  }
}

/** Whether a name is a known stretch exercise (for auto-tagging). */
function isStretchName(name: string): boolean {
  const lower = name.toLowerCase();
  return getExercises().some(
    (e) => e.category === "stretch" && e.name.toLowerCase() === lower
  );
}
