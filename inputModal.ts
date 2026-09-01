import { App, ButtonComponent, Modal, Notice, Platform, setIcon } from "obsidian";
import { getExercises } from "./exerciseDb";
import { parseExerciseLine } from "./parser";
import { showDurationPicker, showWeightPicker } from "./wheelPicker";

/*
 * inputModal.ts
 *
 * A single quick-log modal used by the FAB, the ribbon icon, the editor-menu
 * item and the "Log exercise" command. It emits one liftoscript line and calls
 * the onSubmit callback (the caller appends it to the active note). The layout
 * is deliberately cohesive: every control is the same height and size, and the
 * strength/stretch sections swap in and out without changing the overall shape
 * of the modal.
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
  /** When editing an existing card line, prefill the fields and preserve the
   *  original completion markers and progress tag on save. */
  editing?: {
    raw: string;
  };
}

type Kind = "strength" | "stretch";

/** A +/- stepper with large touch targets and an optional compact variant
 *  used for the per-set weight controls so many sets still fit. */
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
      compact?: boolean;
      onChange: (v: number) => void;
    }
  ) {
    this.value = opts.initial;
    this.step = opts.step;
    this.min = opts.min;
    this.max = opts.max;
    this.onChange = opts.onChange;

    this.el = document.createElement("div");
    this.el.className = "liftoscript-stepper" + (opts.compact ? " liftoscript-stepper-compact" : "");

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "liftoscript-stepper-btn";
    minus.textContent = "−";
    minus.setAttribute("aria-label", `${opts.label}: decrease`);
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
    plus.setAttribute("aria-label", `${opts.label}: increase`);
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

/** A slider + editable number control for a time value. The slider makes large
 *  adjustments easy. The value displays as a large, unclipped number (a span,
 *  so its size is reliable across browsers/themes) that swaps to a native
 *  number input on tap for exact entry. */
class SliderField {
  el: HTMLDivElement;
  private slider: HTMLInputElement;
  private numberBox: HTMLDivElement;
  private numberSpan: HTMLSpanElement;
  private numberInput: HTMLInputElement | null = null;
  private readonly min: number;
  private readonly max: number;
  private readonly step: number;
  private readonly onChange: (v: number) => void;

  constructor(
    opts: {
      initial: number;
      min: number;
      max: number;
      step: number;
      onChange: (v: number) => void;
    }
  ) {
    this.min = opts.min;
    this.max = opts.max;
    this.step = opts.step;
    this.onChange = opts.onChange;

    this.el = document.createElement("div");
    this.el.className = "liftoscript-slider";

    this.slider = document.createElement("input");
    this.slider.type = "range";
    this.slider.className = "liftoscript-slider-range";
    this.slider.min = String(opts.min);
    this.slider.max = String(opts.max);
    this.slider.step = String(opts.step);
    this.slider.value = String(opts.initial);

    this.numberBox = document.createElement("div");
    this.numberBox.className = "liftoscript-slider-number";

    this.numberSpan = document.createElement("span");
    this.numberSpan.className = "liftoscript-slider-number-value";
    this.numberSpan.textContent = String(opts.initial);
    this.numberSpan.setAttribute("role", "button");
    this.numberSpan.setAttribute("tabindex", "0");
    this.numberSpan.setAttribute("aria-label", "Edit seconds");
    const openPickerOrEdit = () => {
      if (Platform.isMobile) {
        // Temporarily detach datalist so Done doesn't trigger the exercise dropdown
        const exInput = document.querySelector<HTMLInputElement>(".liftoscript-modal .liftoscript-input[list]");
        const savedList = exInput?.getAttribute("list") ?? null;
        if (exInput) exInput.removeAttribute("list");
        showDurationPicker({
          title: "Select duration",
          initialSeconds: this.getValue(),
          min: this.min,
          max: this.max,
          step: this.step,
          onConfirm: (v) => {
            this.setDisplay(v);
            this.onChange(v);
            // Restore datalist and keep focus on the number, not the exercise bar
            window.setTimeout(() => {
              if (exInput && savedList) exInput.setAttribute("list", savedList);
              if (exInput && document.activeElement === exInput) exInput.blur();
              this.numberSpan.focus();
            }, 60);
          },
        });
        // If picker is cancelled, restore list as well (wheelPicker close without confirm)
        window.setTimeout(() => {
          const check = () => {
            if (!document.querySelector(".liftoscript-wheel-overlay")) {
              if (exInput && savedList && !exInput.getAttribute("list")) {
                exInput.setAttribute("list", savedList);
              }
            } else {
              window.setTimeout(check, 300);
            }
          };
          window.setTimeout(check, 700);
        }, 700);
      } else {
        this.startEditing();
      }
    };
    this.numberSpan.addEventListener("click", openPickerOrEdit);
    this.numberSpan.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPickerOrEdit();
      }
    });

    this.numberBox.appendChild(this.numberSpan);
    this.numberBox.addEventListener("click", (e) => {
      if (e.target === this.numberBox) openPickerOrEdit();
    });

    this.slider.addEventListener("input", () => {
      const v = parseInt(this.slider.value, 10);
      if (!Number.isNaN(v)) {
        this.setDisplay(v);
        this.onChange(v);
      }
    });

    const arrows = document.createElement("div");
    arrows.className = "liftoscript-slider-arrows";
    this.arrow(true, arrows);
    this.arrow(false, arrows);

    this.el.append(this.slider, this.numberBox, arrows);
  }

  /** Render the value into the display span (and slider). */
  private setDisplay(v: number): void {
    this.numberSpan.textContent = String(v);
    this.slider.value = String(v);
  }

  /** Swap the big span for a native number input to edit the exact value. */
  private startEditing(): void {
    if (this.numberInput) {
      return;
    }
    const input = document.createElement("input");
    input.type = "number";
    input.className = "liftoscript-slider-number-input";
    input.min = String(this.min);
    input.max = String(this.max);
    input.step = String(this.step);
    input.value = String(this.getValue());
    input.setAttribute("inputmode", "numeric");

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.commitEditing();
      } else if (e.key === "Escape") {
        this.cancelEditing();
      }
    });
    input.addEventListener("blur", () => this.commitEditing());

    this.numberBox.empty();
    this.numberBox.appendChild(input);
    this.numberInput = input;
    input.focus();
    input.select();
  }

  /** Commit the edited value and return to the big span display. */
  private commitEditing(): void {
    const input = this.numberInput;
    if (!input) {
      return;
    }
    const raw = parseInt(input.value, 10);
    const v = Number.isNaN(raw) ? this.min : clamp(raw, this.min, this.max);
    this.numberInput = null;
    this.numberBox.empty();
    this.numberBox.appendChild(this.numberSpan);
    this.setDisplay(v);
    this.onChange(v);
  }

  /** Abandon editing and restore the previous displayed value. */
  private cancelEditing(): void {
    this.numberInput = null;
    this.numberBox.empty();
    this.numberBox.appendChild(this.numberSpan);
  }

  /** A fine-tune step button shown as an arrow head (chevron). */
  private arrow(up: boolean, parent: HTMLDivElement): void {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "liftoscript-slider-arrow";
    btn.setAttribute(
      "aria-label",
      up ? `Increase by ${this.step}` : `Decrease by ${this.step}`
    );
    // Build SVG with proper namespace so mobile WebViews render it reliably
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.5");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("aria-hidden", "true");
    const poly = document.createElementNS(svgNS, "polyline");
    poly.setAttribute("points", up ? "6 15 12 9 18 15" : "6 9 12 15 18 9");
    svg.appendChild(poly);
    btn.appendChild(svg);
    btn.addEventListener("click", () => {
      const next = clamp(this.getValue() + (up ? 1 : -1) * this.step, this.min, this.max);
      this.setValue(next);
      this.onChange(next);
    });
    parent.appendChild(btn);
  }

  getValue(): number {
    return parseInt(this.numberSpan.textContent ?? String(this.slider.value), 10);
  }

  setValue(v: number): void {
    const clamped = clamp(v, this.min, this.max);
    this.setDisplay(clamped);
  }
}

/** A per-set weight card: header "Set N" plus a horizontal [-] [value] [+] row.
 *  The value is a large tappable span that swaps to a native number input for
 *  exact entry, keeping the row compact and scannable. */
class WeightCard {
  el: HTMLDivElement;
  private value: number;
  private readonly step: number;
  private readonly min: number;
  private readonly max: number;
  private readonly onChange: (v: number) => void;
  private valueEl: HTMLSpanElement;
  private editingInput: HTMLInputElement | null = null;

  constructor(opts: {
    label: string;
    initial: number;
    step: number;
    min: number;
    max: number;
    onChange: (v: number) => void;
  }) {
    this.value = opts.initial;
    this.step = opts.step;
    this.min = opts.min;
    this.max = opts.max;
    this.onChange = opts.onChange;

    this.el = document.createElement("div");
    this.el.className = "liftoscript-weight-card";

    const header = document.createElement("div");
    header.className = "liftoscript-weight-card-header";
    header.textContent = opts.label;
    this.el.appendChild(header);

    const row = document.createElement("div");
    row.className = "liftoscript-weight-card-row";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "liftoscript-weight-card-btn";
    minus.textContent = "−";
    minus.setAttribute("aria-label", `${opts.label}: decrease`);
    minus.addEventListener("click", () => this.stepBy(-1));

    this.valueEl = document.createElement("span");
    this.valueEl.className = "liftoscript-weight-card-value";
    this.valueEl.textContent = String(this.value);
    this.valueEl.setAttribute("role", "button");
    this.valueEl.setAttribute("tabindex", "0");
    this.valueEl.setAttribute("aria-label", `${opts.label}: tap to edit`);
    const openPickerOrEdit = () => {
      if (Platform.isMobile) {
        const exInput = document.querySelector<HTMLInputElement>(".liftoscript-modal .liftoscript-input[list]");
        const savedList = exInput?.getAttribute("list") ?? null;
        if (exInput) exInput.removeAttribute("list");
        showWeightPicker({
          title: opts.label,
          initial: this.value,
          min: this.min,
          max: this.max,
          step: this.step,
          onConfirm: (v) => {
            this.setValue(v);
            this.onChange(v);
            window.setTimeout(() => {
              if (exInput && savedList) exInput.setAttribute("list", savedList);
              if (exInput && document.activeElement === exInput) exInput.blur();
              this.valueEl.focus();
            }, 60);
          },
        });
        window.setTimeout(() => {
          const check = () => {
            if (!document.querySelector(".liftoscript-wheel-overlay")) {
              if (exInput && savedList && !exInput.getAttribute("list")) {
                exInput.setAttribute("list", savedList);
              }
            } else {
              window.setTimeout(check, 300);
            }
          };
          window.setTimeout(check, 700);
        }, 700);
      } else {
        this.startEditing();
      }
    };
    this.valueEl.addEventListener("click", openPickerOrEdit);
    this.valueEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPickerOrEdit();
      }
    });

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "liftoscript-weight-card-btn liftoscript-weight-card-btn-plus";
    plus.textContent = "+";
    plus.setAttribute("aria-label", `${opts.label}: increase`);
    plus.addEventListener("click", () => this.stepBy(1));

    row.append(minus, this.valueEl, plus);
    this.el.appendChild(row);
  }

  getValue(): number {
    return this.value;
  }

  setValue(v: number): void {
    this.value = clamp(v, this.min, this.max);
    if (this.editingInput) {
      this.editingInput.value = String(this.value);
    } else {
      this.valueEl.textContent = String(this.value);
    }
  }

  private stepBy(dir: number): void {
    this.setValue(Math.round((this.value + dir * this.step) * 100) / 100);
    this.onChange(this.value);
  }

  private startEditing(): void {
    if (this.editingInput) return;
    const input = document.createElement("input");
    input.type = "number";
    input.className = "liftoscript-weight-card-input";
    input.min = String(this.min);
    input.max = String(this.max);
    input.step = String(this.step);
    input.value = String(this.value);
    input.setAttribute("inputmode", "numeric");
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); this.commitEditing(); }
      else if (e.key === "Escape") this.cancelEditing();
    });
    input.addEventListener("blur", () => this.commitEditing());
    this.valueEl.replaceWith(input);
    this.editingInput = input;
    input.focus();
    input.select();
  }

  private commitEditing(): void {
    const input = this.editingInput;
    if (!input) return;
    const raw = parseFloat(input.value);
    const v = Number.isNaN(raw) ? this.min : clamp(Math.round(raw * 100) / 100, this.min, this.max);
    this.value = v;
    input.replaceWith(this.valueEl);
    this.editingInput = null;
    this.valueEl.textContent = String(this.value);
    this.onChange(this.value);
  }

  private cancelEditing(): void {
    const input = this.editingInput;
    if (!input) return;
    input.replaceWith(this.valueEl);
    this.editingInput = null;
  }
}

/** Clamp a value into the inclusive [min, max] range. */
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export class LogExerciseModal extends Modal {
  private readonly opts: InputModalOptions;
  private nameInput: HTMLInputElement | null = null;
  private kindStrength: HTMLButtonElement | null = null;
  private kindStretch: HTMLButtonElement | null = null;
  private sets: Stepper | null = null;
  private reps: Stepper | null = null;
  private weightSteppers: WeightCard[] = [];
  private weightFields: HTMLDivElement | null = null;
  private weightUnit: HTMLSelectElement | null = null;
  private bwToggle: HTMLInputElement | null = null;
  private isBodyweightMode = false;
  private hold: SliderField | null = null;
  private stretchRest: SliderField | null = null;
  private rest: SliderField | null = null;
  private strengthFields: HTMLDivElement | null = null;
  private stretchFields: HTMLDivElement | null = null;
  private editingMarkers: string[] | null = null;
  private editingProgress = "";

  constructor(app: App, opts: InputModalOptions) {
    super(app);
    this.opts = opts;
    if (opts.editing) {
      this.editingMarkers = extractMarkers(opts.editing.raw);
      this.editingProgress = extractProgressSuffix(opts.editing.raw);
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.className += " liftoscript-modal";

    const header = contentEl.createDiv({ cls: "liftoscript-modal-header" });
    header.createEl("h2", { text: this.opts.editing ? "Edit exercise" : "Log exercise" });

    // Exercise name: a single text box with native autocomplete from the active
    // database, so picking and typing a custom name share one control.
    const nameField = this.field(contentEl, "Exercise");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "liftoscript-input";
    nameInput.setAttribute("list", "liftoscript-exercise-datalist");
    nameInput.placeholder = "Type or pick an exercise…";
    nameInput.autocomplete = "off";
    nameField.control.appendChild(nameInput);
    this.nameInput = nameInput;

    const datalist = document.createElement("datalist");
    datalist.id = "liftoscript-exercise-datalist";
    const exercises = getExercises();
    const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name));
    // Limit dropdown: only show matching exercises after 2 chars, max 25.
    // Prevents the full 800-item list from obscuring the modal.
    const updateDatalist = () => {
      const q = nameInput.value.trim().toLowerCase();
      datalist.empty();
      if (q.length < 2) return;
      const filtered = sorted.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 25);
      for (const e of filtered) {
        const opt = document.createElement("option");
        opt.value = e.name;
        datalist.appendChild(opt);
      }
    };
    nameInput.addEventListener("input", updateDatalist);
    nameInput.addEventListener("focus", () => {
      if (nameInput.value.trim().length >= 2) updateDatalist();
    });
    nameField.control.appendChild(datalist);

    // Type: a segmented Strength / Stretch selector.
    const typeField = this.field(contentEl, "Type");
    const seg = typeField.control.createDiv({ cls: "liftoscript-segmented" });
    this.kindStrength = seg.createEl("button", {
      cls: "liftoscript-segmented-btn is-active",
      text: "Strength",
    });
    this.kindStrength.type = "button";
    this.kindStretch = seg.createEl("button", {
      cls: "liftoscript-segmented-btn",
      text: "Stretch",
    });
    this.kindStretch.type = "button";
    this.kindStrength.addEventListener("click", () => this.setKind("strength"));
    this.kindStretch.addEventListener("click", () => this.setKind("stretch"));

    // Strength fields
    this.strengthFields = contentEl.createDiv({ cls: "liftoscript-fields" });

    const metricGrid = this.strengthFields.createDiv({ cls: "liftoscript-metric-grid" });
    this.sets = new Stepper({
      initial: 3, step: 1, min: 1, max: 12, label: "Sets",
      onChange: () => this.renderWeightSteppers(),
    });
    metricGrid.appendChild(this.sets.el);
    this.reps = new Stepper({
      initial: 5, step: 1, min: 0, max: 30, label: "Reps",
      onChange: () => {},
    });
    metricGrid.appendChild(this.reps.el);

    const restField = this.field(this.strengthFields, "Rest");
    this.rest = new SliderField({
      initial: 90, step: 15, min: 0, max: 600,
      onChange: () => {},
    });
    restField.control.appendChild(this.rest.el);

    const weightField = this.field(this.strengthFields, "Weight per set");
    const unitRow = weightField.control.createDiv({ cls: "liftoscript-weight-head" });
    unitRow.createDiv({ cls: "liftoscript-field-hint", text: "Pick the unit, then set each set's weight." });
    this.weightUnit = document.createElement("select");
    this.weightUnit.className = "liftoscript-select liftoscript-select-small";
    const lb = document.createElement("option");
    lb.value = "lb";
    lb.textContent = "lb";
    this.weightUnit.appendChild(lb);
    const kg = document.createElement("option");
    kg.value = "kg";
    kg.textContent = "kg";
    this.weightUnit.appendChild(kg);
    unitRow.appendChild(this.weightUnit);

    this.weightFields = weightField.control.createDiv({ cls: "liftoscript-weight-sets" });
    this.renderWeightSteppers();

    // Bodyweight toggle — when on, weight cards are added load (0 = BW, 25 = BW+25)
    const bwRow = this.strengthFields.createDiv({ cls: "liftoscript-bw-row" });
    const bwLabel = bwRow.createEl("label", { cls: "liftoscript-bw-label" });
    this.bwToggle = document.createElement("input");
    this.bwToggle.type = "checkbox";
    this.bwToggle.className = "liftoscript-bw-checkbox";
    bwLabel.appendChild(this.bwToggle);
    const bwText = document.createElement("span");
    bwText.textContent = " Bodyweight (BW)";
    bwLabel.appendChild(bwText);
    bwRow.createDiv({ cls: "liftoscript-field-hint", text: "When on, 0 = BW, 25 = BW+25lb" });
    this.bwToggle.addEventListener("change", () => {
      this.isBodyweightMode = this.bwToggle?.checked ?? false;
      // Re-render cards so min allows negative for assisted BW
      const keep = this.weightSteppers.map((s) => s.getValue());
      this.renderWeightSteppers();
      keep.forEach((v, i) => this.setWeightForSet(i, v));
    });

    // Stretch fields
    this.stretchFields = contentEl.createDiv({ cls: "liftoscript-fields" });

    const holdField = this.field(this.stretchFields, "Hold (s)");
    this.hold = new SliderField({
      initial: 45, step: 5, min: 5, max: 300,
      onChange: () => {},
    });
    holdField.control.appendChild(this.hold.el);

    const stretchRestField = this.field(this.stretchFields, "Rest (s)");
    this.stretchRest = new SliderField({
      initial: 15, step: 5, min: 0, max: 300,
      onChange: () => {},
    });
    stretchRestField.control.appendChild(this.stretchRest.el);

    this.setKind("strength");
    if (this.opts.editing) {
      this.prefillFromExisting(this.opts.editing.raw);
    }

    const actions = contentEl.createDiv({ cls: "liftoscript-modal-actions" });
    new ButtonComponent(actions).setButtonText("Cancel").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText(this.opts.editing ? "Save" : "Add").setCta().onClick(async () => {
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

  /** A labelled form field: label row on top, control below. Consistent. */
  private field(
    parent: HTMLElement,
    label: string,
    hint?: string
  ): { control: HTMLDivElement } {
    const wrap = parent.createDiv({ cls: "liftoscript-field" });
    const labelRow = wrap.createDiv({ cls: "liftoscript-field-label" });
    labelRow.textContent = label;
    if (hint) {
      labelRow.title = hint;
    }
    const control = wrap.createDiv({ cls: "liftoscript-field-control" });
    return { control };
  }

  /** Switch the visible section between strength and stretch. */
  private setKind(kind: Kind): void {
    const isStrength = kind === "strength";
    this.kindStrength?.toggleClass("is-active", isStrength);
    this.kindStretch?.toggleClass("is-active", !isStrength);
    if (this.strengthFields) {
      this.strengthFields.style.display = isStrength ? "" : "none";
    }
    if (this.stretchFields) {
      this.stretchFields.style.display = isStrength ? "none" : "";
    }
  }

  /** (Re)build one weight card per set, preserving values that already exist
   *  so re-rendering on a sets change doesn't discard the user's input. */
  private renderWeightSteppers(): void {
    if (!this.weightFields) {
      return;
    }
    const count = this.sets?.getValue() ?? 3;
    const previous = this.weightSteppers.map((s) => s.getValue());
    this.weightFields.empty();
    this.weightSteppers = [];
    for (let i = 0; i < count; i++) {
      const label = count > 1 ? `Set ${i + 1}` : "Weight";
      const card = new WeightCard({
        label,
        initial: previous[i] ?? 100,
        step: 5,
        min: this.isBodyweightMode ? -200 : 0,
        max: 1000,
        onChange: () => {},
      });
      this.weightSteppers.push(card);
      this.weightFields.appendChild(card.el);
    }
  }

  /** Current weight value for a 1-indexed set. */
  private weightForSet(index: number): number {
    return this.weightSteppers[index]?.getValue() ?? 0;
  }

  /** Set the weight value for a 1-indexed set, used when prefilling edit mode. */
  private setWeightForSet(index: number, value: number): void {
    this.weightSteppers[index]?.setValue(value);
  }

  /** Populate the fields from an existing rendered card line (edit mode). */
  private prefillFromExisting(raw: string): void {
    const ex = parseExerciseLine(raw);
    const name = ex.name.trim();
    if (name) {
      if (this.nameInput) {
        this.nameInput.value = name;
      }
    }
    const kind: Kind = ex.isStretch ? "stretch" : "strength";
    this.setKind(kind);
    if (ex.isStretch) {
      const first = ex.sets[0];
      this.sets?.setValue(ex.sets.length);
      this.hold?.setValue(first?.seconds ?? 45);
      this.stretchRest?.setValue(first?.restSeconds ?? this.stretchRest?.getValue() ?? 15);
    } else {
      const exSets = ex.sets.length || 1;
      const firstIsBW = !!ex.sets[0]?.isBodyweight;
      this.isBodyweightMode = firstIsBW;
      if (this.bwToggle) this.bwToggle.checked = firstIsBW;
      this.sets?.setValue(exSets);
      this.renderWeightSteppers();
      const first = ex.sets[0];
      this.reps?.setValue(first?.reps ?? 5);
      ex.sets.forEach((set, i) => {
        if (set.isBodyweight) {
          this.setWeightForSet(i, set.addedWeight?.value ?? 0);
        } else {
          this.setWeightForSet(i, set.weight.value);
        }
      });
      if (first) {
        const unit = first.isBodyweight ? first.addedWeight?.unit : first.weight.unit;
        if (unit && this.weightUnit) this.weightUnit.value = unit;
      }
      if (ex.restSeconds > 0) {
        this.rest?.setValue(ex.restSeconds);
      }
    }
  }

  private resolveName(): string {
    return this.nameInput?.value?.trim() ?? "";
  }

  /** Build the log line, or null if invalid (name missing). */
  private buildResult(): LogExerciseResult | null {
    const name = this.resolveName();
    if (!name) {
      new Notice("Enter an exercise name.");
      this.nameInput?.focus();
      return null;
    }
    const kind = this.kindStretch?.hasClass("is-active") ? "stretch" : "strength";

    if (kind === "stretch") {
      const sets = this.sets?.getValue() ?? 3;
      const hold = this.hold?.getValue() ?? 45;
      const rest = this.stretchRest?.getValue() ?? 15;
      const markers = this.applyMarkers(sets);
      const spec = rest > 0 ? `${sets}x${hold}s|${rest}s` : `${sets}x${hold}s`;
      const tag = isStretchName(name) ? "" : ", type: stretch";
      const progress = this.editingProgress;
      return {
        line: `${markers} ${name} / ${spec}${tag}${progress}`,
        name,
        isStretch: true,
      };
    }

    const sets = this.sets?.getValue() ?? 3;
    const reps = this.reps?.getValue() ?? 5;
    const unit = this.weightUnit?.value ?? "lb";
    const rest = this.rest?.getValue() ?? 90;
    const markers = this.applyMarkers(sets);
    const tokens = Array.from({ length: sets }, (_, i) => {
      const w = this.weightForSet(i);
      if (this.isBodyweightMode) {
        if (w === 0) return `${reps}xbw`;
        if (w > 0) return `${reps}xbw+${w}${unit}`;
        return `${reps}xbw${w}${unit}`;
      }
      return `${reps}x${w}${unit}`;
    }).join(", ");
    const line =
      `${markers} ${name} / ${tokens}` +
      (rest > 0 ? `, rest: ${rest}` : "") +
      this.editingProgress;
    return { line, name, isStretch: false };
  }

  /** Preserve the original completion markers when editing, adapting to the
   *  new set count; otherwise emit a fresh set of unchecked markers. */
  private applyMarkers(count: number): string {
    if (this.editingMarkers && this.editingMarkers.length > 0) {
      const markers = this.editingMarkers.slice(0, count);
      while (markers.length < count) {
        markers.push("[ ]");
      }
      return markers.join(" ");
    }
    return Array(count).fill("[ ]").join(" ");
  }
}

/** Whether a name is a known stretch exercise (for auto-tagging). */
function isStretchName(name: string): boolean {
  const lower = name.toLowerCase();
  return getExercises().some(
    (e) => e.category === "stretch" && e.name.toLowerCase() === lower
  );
}

/** Extract the leading completion markers "[ ]" / "[x]" from a raw line. */
function extractMarkers(raw: string): string[] {
  const markers: string[] = [];
  const re = /\[([ xX])\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    markers.push(m[0]);
  }
  return markers;
}

/** Extract the trailing ", progress: ..." suffix from a raw line, if any. */
function extractProgressSuffix(raw: string): string {
  const idx = raw.search(/,\s*progress\s*:/i);
  if (idx === -1) {
    return "";
  }
  return raw.slice(idx).trim();
}
