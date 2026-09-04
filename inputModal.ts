import { App, ButtonComponent, Modal, Notice } from "obsidian";
import { getExercises } from "./exerciseDb";
import { parseExerciseLine } from "./parser";

/*
 * inputModal.ts
 *
 * Quick-log / edit modal — streamlined for desktop power-users.
 * - Permanently visible numeric inputs flanked by compact subtle -/+.
 * - Top row: Exercise (70%) + Type (30%) on same line.
 * - Numeric row: Sets | Reps/Hold | Rest (S) as single 3-column grid.
 * - Weight matrix: tight inline rows (Set 1: [input] lb) without card padding.
 * - Strict tabindex + Enter-to-submit + auto-select on focus.
 */

export interface LogExerciseResult {
  line: string;
  name: string;
  isStretch: boolean;
}

export interface InputModalOptions {
  onSubmit: (result: LogExerciseResult) => void | Promise<void>;
  initialName?: string;
  editing?: { raw: string };
}

type Kind = "strength" | "stretch";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Permanently visible numeric input flanked by compact subtle -/+ buttons.
 *  No click-to-edit overlay; auto-select on focus; Enter triggers submit. */
class Stepper {
  el: HTMLDivElement;
  input: HTMLInputElement;
  private value: number;
  private readonly step: number;
  private readonly min: number;
  private readonly max: number;
  private readonly label: string;
  private readonly allowDecimal: boolean;
  private readonly onChange: (v: number) => void;
  private readonly onSubmit: () => void;

  constructor(opts: {
    initial: number;
    step: number;
    min: number;
    max: number;
    label: string;
    tabindex?: number;
    allowDecimal?: boolean;
    onChange: (v: number) => void;
    onSubmit: () => void;
  }) {
    this.value = clamp(opts.initial, opts.min, opts.max);
    this.step = opts.step;
    this.min = opts.min;
    this.max = opts.max;
    this.label = opts.label;
    this.allowDecimal = opts.allowDecimal ?? false;
    this.onChange = opts.onChange;
    this.onSubmit = opts.onSubmit;

    this.el = document.createElement("div");
    this.el.className = "liftoscript-stepper liftoscript-stepper-compact";

    const labelEl = document.createElement("div");
    labelEl.className = "liftoscript-stepper-label";
    labelEl.textContent = opts.label;
    this.el.appendChild(labelEl);

    const controls = document.createElement("div");
    controls.className = "liftoscript-stepper-controls";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "liftoscript-stepper-btn";
    minus.textContent = "−";
    minus.tabIndex = -1;
    minus.setAttribute("aria-label", `${opts.label}: decrease`);
    minus.addEventListener("click", () => this.stepBy(-1));

    this.input = document.createElement("input");
    this.input.type = "number";
    this.input.className = "liftoscript-stepper-input";
    this.input.min = String(this.min);
    this.input.max = String(this.max);
    this.input.step = String(this.step);
    this.input.value = this.format(this.value);
    this.input.setAttribute("inputmode", this.allowDecimal ? "decimal" : "numeric");
    this.input.setAttribute("aria-label", opts.label);
    if (opts.tabindex != null) this.input.tabIndex = opts.tabindex;
    this.input.addEventListener("focus", () => {
      // auto-select all text for immediate typing
      window.setTimeout(() => this.input.select(), 0);
    });
    this.input.addEventListener("input", () => this.handleInput());
    this.input.addEventListener("change", () => this.handleCommit());
    this.input.addEventListener("blur", () => this.handleCommit());
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.handleCommit();
        this.onSubmit();
      }
    });

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "liftoscript-stepper-btn liftoscript-stepper-btn-plus";
    plus.textContent = "+";
    plus.tabIndex = -1;
    plus.setAttribute("aria-label", `${opts.label}: increase`);
    plus.addEventListener("click", () => this.stepBy(1));

    controls.append(minus, this.input, plus);
    this.el.appendChild(controls);
  }

  getValue(): number {
    return this.value;
  }

  setValue(v: number): void {
    this.value = clamp(this.round(v), this.min, this.max);
    this.input.value = this.format(this.value);
  }

  setTabIndex(ti: number): void {
    this.input.tabIndex = ti;
  }

  private format(v: number): string {
    if (this.allowDecimal) return String(Math.round(v * 100) / 100);
    return String(Math.round(v));
  }
  private round(v: number): number {
    if (this.allowDecimal) return Math.round(v * 100) / 100;
    return Math.round(v);
  }
  private stepBy(dir: number): void {
    this.setValue(this.round(this.value + dir * this.step));
    this.onChange(this.value);
    this.input.focus();
    this.input.select();
  }
  private handleInput(): void {
    const raw = this.allowDecimal ? parseFloat(this.input.value) : parseInt(this.input.value, 10);
    if (Number.isNaN(raw)) return;
    this.value = clamp(this.round(raw), this.min, this.max);
    this.onChange(this.value);
  }
  private handleCommit(): void {
    const raw = this.allowDecimal ? parseFloat(this.input.value) : parseInt(this.input.value, 10);
    const v = Number.isNaN(raw) ? this.value : clamp(this.round(raw), this.min, this.max);
    this.setValue(v);
    this.onChange(this.value);
  }
}

/** Compact inline weight row: `Set N: [ - ] [input] [ + ]` with BW prefix + signed hint. */
class WeightRow {
  el: HTMLDivElement;
  input: HTMLInputElement;
  private value: number;
  private readonly step: number;
  private min: number;
  private max: number;
  private unit: string;
  private isBodyweight: boolean;
  private readonly onChange: (v: number) => void;
  private readonly onSubmit: () => void;
  private labelEl: HTMLSpanElement;
  private bwPrefixEl: HTMLSpanElement;
  private bwHintEl: HTMLSpanElement;

  constructor(opts: {
    label: string;
    initial: number;
    step: number;
    min: number;
    max: number;
    unit: string;
    isBodyweight: boolean;
    tabindex?: number;
    onChange: (v: number) => void;
    onSubmit: () => void;
  }) {
    this.value = clamp(opts.initial, opts.min, opts.max);
    this.step = opts.step;
    this.min = opts.min;
    this.max = opts.max;
    this.unit = opts.unit;
    this.isBodyweight = opts.isBodyweight;
    this.onChange = opts.onChange;
    this.onSubmit = opts.onSubmit;

    this.el = document.createElement("div");
    this.el.className = "liftoscript-weight-row";

    this.labelEl = document.createElement("span");
    this.labelEl.className = "liftoscript-weight-row-label";
    this.labelEl.textContent = opts.label + ":";
    this.el.appendChild(this.labelEl);

    this.bwPrefixEl = document.createElement("span");
    this.bwPrefixEl.className = "liftoscript-weight-row-bw-prefix";
    this.bwPrefixEl.textContent = "BW";
    this.bwPrefixEl.style.display = opts.isBodyweight ? "" : "none";
    this.el.appendChild(this.bwPrefixEl);

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "liftoscript-weight-row-btn";
    minus.textContent = "−";
    minus.tabIndex = -1;
    minus.setAttribute("aria-label", `${opts.label}: decrease`);
    minus.addEventListener("click", () => this.stepBy(-1));

    this.input = document.createElement("input");
    this.input.type = "number";
    this.input.className = "liftoscript-weight-row-input";
    this.input.min = String(this.min);
    this.input.max = String(this.max);
    this.input.step = String(this.step);
    this.input.value = String(this.value);
    this.input.setAttribute("inputmode", "decimal");
    this.input.setAttribute("aria-label", `${opts.label} weight`);
    if (opts.tabindex != null) this.input.tabIndex = opts.tabindex;
    this.input.addEventListener("focus", () => window.setTimeout(() => this.input.select(), 0));
    this.input.addEventListener("input", () => this.handleInput());
    this.input.addEventListener("change", () => this.handleCommit());
    this.input.addEventListener("blur", () => this.handleCommit());
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.handleCommit();
        this.onSubmit();
      }
    });

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "liftoscript-weight-row-btn liftoscript-weight-row-btn-plus";
    plus.textContent = "+";
    plus.tabIndex = -1;
    plus.setAttribute("aria-label", `${opts.label}: increase`);
    plus.addEventListener("click", () => this.stepBy(1));

    this.bwHintEl = document.createElement("span");
    this.bwHintEl.className = "liftoscript-weight-row-bw";
    this.refreshBwHint();

    this.el.append(minus, this.input, plus, this.bwHintEl);
  }

  getValue(): number {
    return this.value;
  }
  setValue(v: number): void {
    this.value = clamp(Math.round(v * 100) / 100, this.min, this.max);
    this.input.value = String(this.value);
    this.refreshBwHint();
  }
  setUnit(unit: string): void {
    this.unit = unit;
    this.refreshBwHint();
  }
  setBodyweightMode(isBW: boolean, min: number): void {
    this.isBodyweight = isBW;
    this.min = min;
    this.input.min = String(min);
    this.value = clamp(this.value, min, this.max);
    this.input.value = String(this.value);
    this.bwPrefixEl.style.display = isBW ? "" : "none";
    this.refreshBwHint();
  }
  setLabel(label: string): void {
    this.labelEl.textContent = label + ":";
  }
  setTabIndex(ti: number): void {
    this.input.tabIndex = ti;
  }
  private stepBy(dir: number): void {
    this.setValue(Math.round((this.value + dir * this.step) * 100) / 100);
    this.onChange(this.value);
    this.input.focus();
    this.input.select();
  }
  private handleInput(): void {
    const raw = parseFloat(this.input.value);
    if (Number.isNaN(raw)) return;
    this.value = clamp(Math.round(raw * 100) / 100, this.min, this.max);
    this.onChange(this.value);
    this.refreshBwHint();
  }
  private handleCommit(): void {
    const raw = parseFloat(this.input.value);
    const v = Number.isNaN(raw) ? this.value : clamp(Math.round(raw * 100) / 100, this.min, this.max);
    this.setValue(v);
    this.onChange(this.value);
  }
  private refreshBwHint(): void {
    if (!this.isBodyweight) {
      this.bwHintEl.textContent = "";
      this.bwHintEl.style.display = "none";
      return;
    }
    this.bwHintEl.style.display = "";
    // Show relative signed value: +0, +10, -5
    if (this.value === 0) this.bwHintEl.textContent = "+0";
    else if (this.value > 0) this.bwHintEl.textContent = `+${this.value}`;
    else this.bwHintEl.textContent = String(this.value);
  }
}

export class LogExerciseModal extends Modal {
  private readonly opts: InputModalOptions;
  private nameInput: HTMLInputElement | null = null;
  private kindStrength: HTMLButtonElement | null = null;
  private kindStretch: HTMLButtonElement | null = null;
  private sets: Stepper | null = null;
  private reps: Stepper | null = null;
  private weightRows: WeightRow[] = [];
  private weightFields: HTMLDivElement | null = null;
  private weightUnit: HTMLSelectElement | null = null;
  private bwToggle: HTMLInputElement | null = null;
  private isBodyweightMode = false;
  private hold: Stepper | null = null;
  private stretchRest: Stepper | null = null;
  private rest: Stepper | null = null;
  private strengthFields: HTMLDivElement | null = null;
  private stretchFields: HTMLDivElement | null = null;
  private editingMarkers: string[] | null = null;
  private editingProgress = "";
  private submitBtn: ButtonComponent | null = null;

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
    header.createEl("h2", { text: this.opts.editing ? "Edit Exercise" : "Add Exercise" });

    // === Top row: Exercise (70%) + Type (30%) ===
    const topRow = contentEl.createDiv({ cls: "liftoscript-top-row" });

    const nameWrap = topRow.createDiv({ cls: "liftoscript-top-row-exercise" });
    const nameField = this.field(nameWrap, "Exercise");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "liftoscript-input";
    nameInput.placeholder = "Type or pick an exercise…";
    nameInput.autocomplete = "off";
    nameInput.setAttribute("spellcheck", "false");
    nameInput.tabIndex = 1;
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void this.handleSubmit();
      }
    });
    nameField.control.addClass("liftoscript-exercise-control");
    nameField.control.appendChild(nameInput);
    this.nameInput = nameInput;

    const suggBox = nameField.control.createDiv({ cls: "liftoscript-exercise-suggestions" });
    suggBox.style.display = "none";
    const exercises = getExercises();
    const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name));
    const updateSuggestions = () => {
      const q = nameInput.value.trim().toLowerCase();
      suggBox.empty();
      if (q.length < 2) { suggBox.style.display = "none"; return; }
      const filtered = sorted.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 30);
      if (filtered.length === 0) { suggBox.style.display = "none"; return; }
      for (const e of filtered) {
        const item = suggBox.createDiv({ cls: "liftoscript-exercise-suggestion", text: e.name });
        item.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          nameInput.value = e.name;
          suggBox.style.display = "none";
          nameInput.focus();
        });
      }
      suggBox.style.display = "block";
    };
    nameInput.addEventListener("input", updateSuggestions);
    nameInput.addEventListener("focus", () => {
      window.setTimeout(() => nameInput.select(), 0);
      if (nameInput.value.trim().length >= 2) updateSuggestions();
    });
    nameInput.addEventListener("blur", () => window.setTimeout(() => (suggBox.style.display = "none"), 150));
    nameInput.addEventListener("keydown", (e) => { if (e.key === "Escape") suggBox.style.display = "none"; });

    const typeWrap = topRow.createDiv({ cls: "liftoscript-top-row-type" });
    const typeField = this.field(typeWrap, "Exercise Type");
    const seg = typeField.control.createDiv({ cls: "liftoscript-segmented" });
    this.kindStrength = seg.createEl("button", { cls: "liftoscript-segmented-btn is-active", text: "Strength" });
    this.kindStrength.type = "button";
    this.kindStrength.tabIndex = 2;
    this.kindStretch = seg.createEl("button", { cls: "liftoscript-segmented-btn", text: "Stretch" });
    this.kindStretch.type = "button";
    this.kindStretch.tabIndex = 3;
    this.kindStrength.addEventListener("click", () => this.setKind("strength"));
    this.kindStretch.addEventListener("click", () => this.setKind("stretch"));

    // === Numeric 3-column row: Sets | Reps/Hold | Rest ===
    // Single shared row with toggling visibility for Reps/Hold and Rest variants.
    const numericRow = contentEl.createDiv({ cls: "liftoscript-numeric-row" });
    const metricGrid = numericRow.createDiv({ cls: "liftoscript-metric-grid" });

    this.sets = new Stepper({
      initial: 3, step: 1, min: 1, max: 12, label: "Sets", tabindex: 4,
      onChange: () => this.renderWeightRows(),
      onSubmit: () => void this.handleSubmit(),
    });
    metricGrid.appendChild(this.sets.el);

    this.reps = new Stepper({
      initial: 5, step: 1, min: 0, max: 30, label: "Reps", tabindex: 5,
      onChange: () => {},
      onSubmit: () => void this.handleSubmit(),
    });
    metricGrid.appendChild(this.reps.el);

    this.hold = new Stepper({
      initial: 45, step: 5, min: 5, max: 300, label: "Hold (s)", tabindex: 5,
      onChange: () => {},
      onSubmit: () => void this.handleSubmit(),
    });
    metricGrid.appendChild(this.hold.el);

    this.rest = new Stepper({
      initial: 90, step: 15, min: 0, max: 600, label: "Rest (s)", tabindex: 6,
      onChange: () => {},
      onSubmit: () => void this.handleSubmit(),
    });
    metricGrid.appendChild(this.rest.el);

    this.stretchRest = new Stepper({
      initial: 15, step: 5, min: 0, max: 300, label: "Rest (s)", tabindex: 6,
      onChange: () => {},
      onSubmit: () => void this.handleSubmit(),
    });
    metricGrid.appendChild(this.stretchRest.el);

    // Strength fields container only for weight section; numeric row is shared above
    this.strengthFields = contentEl.createDiv({ cls: "liftoscript-fields" });
    const weightSection = this.strengthFields.createDiv({ cls: "liftoscript-weight-section" });
    const weightHeader = weightSection.createDiv({ cls: "liftoscript-weight-header" });
    const weightTitleEl = document.createElement("div");
    weightTitleEl.className = "liftoscript-field-label";
    weightTitleEl.textContent = "Weight per set";
    weightHeader.appendChild(weightTitleEl);

    const weightHeaderActions = document.createElement("div");
    weightHeaderActions.className = "liftoscript-weight-header-actions";
    weightHeader.appendChild(weightHeaderActions);

    const bwLabel = document.createElement("label");
    bwLabel.className = "liftoscript-bw-toggle";
    this.bwToggle = document.createElement("input");
    this.bwToggle.type = "checkbox";
    this.bwToggle.className = "liftoscript-bw-checkbox";
    this.bwToggle.tabIndex = -1;
    const bwSwitch = document.createElement("span");
    bwSwitch.className = "liftoscript-bw-switch";
    const bwText = document.createElement("span");
    bwText.className = "liftoscript-bw-text";
    bwText.textContent = "Bodyweight";
    bwLabel.append(this.bwToggle, bwSwitch, bwText);
    weightHeaderActions.appendChild(bwLabel);

    this.weightUnit = document.createElement("select");
    this.weightUnit.className = "liftoscript-select liftoscript-select-small";
    this.weightUnit.tabIndex = -1;
    const lb = document.createElement("option"); lb.value = "lb"; lb.textContent = "lb";
    const kg = document.createElement("option"); kg.value = "kg"; kg.textContent = "kg";
    this.weightUnit.append(lb, kg);
    weightHeaderActions.appendChild(this.weightUnit);
    this.weightUnit.addEventListener("change", () => {
      const unit = this.weightUnit?.value ?? "lb";
      this.weightRows.forEach((r) => r.setUnit(unit));
    });

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "liftoscript-copy-btn";
    copyBtn.textContent = "Copy Weight to All Sets";
    copyBtn.tabIndex = -1;
    copyBtn.setAttribute("aria-label", "Copy first set weight to all sets");
    copyBtn.addEventListener("click", () => this.copyWeightToAll());
    weightHeaderActions.appendChild(copyBtn);

    this.weightFields = weightSection.createDiv({ cls: "liftoscript-weight-sets liftoscript-weight-matrix" });
    this.renderWeightRows();

    this.bwToggle.addEventListener("change", () => {
      this.isBodyweightMode = this.bwToggle?.checked ?? false;
      const keep = this.weightRows.map((r) => r.getValue());
      const unit = this.weightUnit?.value ?? "lb";
      this.renderWeightRows();
      keep.forEach((v, i) => this.setWeightForSet(i, v));
      this.weightRows.forEach((r) => {
        r.setUnit(unit);
        r.setBodyweightMode(this.isBodyweightMode, this.isBodyweightMode ? -200 : 0);
      });
    });

    this.stretchFields = contentEl.createDiv({ cls: "liftoscript-fields" });
    // stretchFields is now placeholder; numeric row handles Hold/Rest visibility. Keep empty for kind toggle.
    this.stretchFields.style.display = "none";

    this.setKind("strength");
    if (this.opts.editing) this.prefillFromExisting(this.opts.editing.raw);

    const actions = contentEl.createDiv({ cls: "liftoscript-modal-actions" });
    new ButtonComponent(actions).setButtonText("Cancel").onClick(() => this.close());
    this.submitBtn = new ButtonComponent(actions)
      .setButtonText(this.opts.editing ? "Save Changes" : "Add Exercise")
      .setCta()
      .onClick(async () => { await this.handleSubmit(); });
    // tabindex for submit: after last weight input
    this.submitBtn.buttonEl.tabIndex = 100;
    this.updateWeightTabIndices();
  }

  onClose(): void { this.contentEl.empty(); }

  private field(parent: HTMLElement, label: string, hint?: string): { labelRow: HTMLDivElement; control: HTMLDivElement } {
    const wrap = parent.createDiv({ cls: "liftoscript-field" });
    const labelRow = wrap.createDiv({ cls: "liftoscript-field-label" });
    labelRow.textContent = label;
    if (hint) labelRow.title = hint;
    const control = wrap.createDiv({ cls: "liftoscript-field-control" });
    return { labelRow, control };
  }

  private setKind(kind: Kind): void {
    const isStrength = kind === "strength";
    this.kindStrength?.toggleClass("is-active", isStrength);
    this.kindStretch?.toggleClass("is-active", !isStrength);
    // toggle numeric steppers: Reps vs Hold, Rest vs StretchRest
    if (this.reps) this.reps.el.style.display = isStrength ? "" : "none";
    if (this.hold) this.hold.el.style.display = isStrength ? "none" : "";
    if (this.rest) this.rest.el.style.display = isStrength ? "" : "none";
    if (this.stretchRest) this.stretchRest.el.style.display = isStrength ? "none" : "";
    if (this.strengthFields) this.strengthFields.style.display = isStrength ? "" : "none";
    if (this.stretchFields) this.stretchFields.style.display = isStrength ? "none" : "";
    // When in stretch mode, weight matrix not needed
    this.updateWeightTabIndices();
  }

  private async handleSubmit(): Promise<void> {
    const result = this.buildResult();
    if (!result) return;
    this.close();
    await this.opts.onSubmit(result);
  }

  private copyWeightToAll(): void {
    if (this.weightRows.length === 0) return;
    const first = this.weightRows[0].getValue();
    for (let i = 1; i < this.weightRows.length; i++) this.weightRows[i].setValue(first);
    if (this.weightRows.length > 1) new Notice(`Copied ${first} to all sets`);
  }

  private renderWeightRows(): void {
    if (!this.weightFields) return;
    const count = this.sets?.getValue() ?? 3;
    const previous = this.weightRows.map((r) => r.getValue());
    const unit = this.weightUnit?.value ?? "lb";
    this.weightFields.empty();
    this.weightRows = [];
    for (let i = 0; i < count; i++) {
      const label = `Set ${i + 1}`;
      const row = new WeightRow({
        label,
        initial: previous[i] ?? 100,
        step: 5, min: this.isBodyweightMode ? -200 : 0, max: 1000,
        unit, isBodyweight: this.isBodyweightMode,
        onChange: () => {},
        onSubmit: () => void this.handleSubmit(),
      });
      this.weightRows.push(row);
      this.weightFields.appendChild(row.el);
    }
    this.updateWeightTabIndices();
  }

  private updateWeightTabIndices(): void {
    // Strict order: after Rest (tab 6), weights start at 7
    let ti = 7;
    for (const r of this.weightRows) r.setTabIndex(ti++);
    if (this.submitBtn) this.submitBtn.buttonEl.tabIndex = ti;
  }

  private weightForSet(index: number): number { return this.weightRows[index]?.getValue() ?? 0; }
  private setWeightForSet(index: number, value: number): void { this.weightRows[index]?.setValue(value); }

  private prefillFromExisting(raw: string): void {
    const ex = parseExerciseLine(raw);
    const name = ex.name.trim();
    if (name && this.nameInput) this.nameInput.value = name;
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
      this.renderWeightRows();
      const first = ex.sets[0];
      this.reps?.setValue(first?.reps ?? 5);
      ex.sets.forEach((set, i) => {
        if (set.isBodyweight) this.setWeightForSet(i, set.addedWeight?.value ?? 0);
        else this.setWeightForSet(i, set.weight.value);
      });
      if (first) {
        const unit = first.isBodyweight ? first.addedWeight?.unit : first.weight.unit;
        if (unit && this.weightUnit) this.weightUnit.value = unit;
      }
      const unit = this.weightUnit?.value ?? "lb";
      this.weightRows.forEach((r) => {
        r.setUnit(unit);
        r.setBodyweightMode(this.isBodyweightMode, this.isBodyweightMode ? -200 : 0);
      });
      if (ex.restSeconds > 0) this.rest?.setValue(ex.restSeconds);
    }
  }

  private resolveName(): string { return this.nameInput?.value?.trim() ?? ""; }

  private buildResult(): LogExerciseResult | null {
    const name = this.resolveName();
    if (!name) { new Notice("Enter an exercise name."); this.nameInput?.focus(); return null; }
    const kind = this.kindStretch?.hasClass("is-active") ? "stretch" : "strength";
    if (kind === "stretch") {
      const sets = this.sets?.getValue() ?? 3;
      const hold = this.hold?.getValue() ?? 45;
      const rest = this.stretchRest?.getValue() ?? 15;
      const markers = this.applyMarkers(sets);
      const spec = rest > 0 ? `${sets}x${hold}s|${rest}s` : `${sets}x${hold}s`;
      const tag = isStretchName(name) ? "" : ", type: stretch";
      return { line: `${markers} ${name} / ${spec}${tag}${this.editingProgress}`, name, isStretch: true };
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
    const line = `${markers} ${name} / ${tokens}` + (rest > 0 ? `, rest: ${rest}` : "") + this.editingProgress;
    return { line, name, isStretch: false };
  }

  private applyMarkers(count: number): string {
    if (this.editingMarkers && this.editingMarkers.length > 0) {
      const markers = this.editingMarkers.slice(0, count);
      while (markers.length < count) markers.push("[ ]");
      return markers.join(" ");
    }
    return Array(count).fill("[ ]").join(" ");
  }
}

function isStretchName(name: string): boolean {
  const lower = name.toLowerCase();
  return getExercises().some((e) => e.category === "stretch" && e.name.toLowerCase() === lower);
}
function extractMarkers(raw: string): string[] {
  const markers: string[] = [];
  const re = /\[([ xX])\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) markers.push(m[0]);
  return markers;
}
function extractProgressSuffix(raw: string): string {
  const idx = raw.search(/,\s*progress\s*:/i);
  if (idx === -1) return "";
  return raw.slice(idx).trim();
}
