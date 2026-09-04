import { App, Modal, Notice, setIcon } from "obsidian";
import { getExercises } from "./exerciseDb";
import { parseExerciseLine } from "./parser";

/**
 * kineticEditModal.ts — Obsidian Kinetic Edit Exercise Modal
 *
 * Implements the Stitch "Obsidian Workout Tracker" designs:
 * - Mobile: 390×813 bottom sheet (drag handle, rounded-t 28px, 92vh, footer fixed)
 * - Desktop: 1280×1024 centered modal (window chrome, 2-col params, 7-col table)
 * Responsive via single DOM + CSS media queries (768px breakpoint).
 *
 * Preserves liftoscript round-tripping: markers, rest, progress suffix.
 */

export interface KineticEditOptions {
  raw?: string;
  sourcePath?: string;
  onSave: (newLine: string) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

type ExerciseKind = "strength" | "stretch" | "cardio";
type SetKind = "warmup" | "normal" | "target" | "drop";

interface KineticSet {
  id: number;
  kind: SetKind;
  prev: string;
  weight: number;
  reps: number;
  rpe: number;
  done: boolean;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function extractMarkers(raw: string): string[] {
  const m = raw.match(/\[([ xX])\]/g);
  return m ?? [];
}
function extractProgress(raw: string): string {
  const idx = raw.search(/,\s*progress\s*:/i);
  return idx === -1 ? "" : raw.slice(idx).trim();
}
function extractRest(raw: string): number {
  const r = raw.match(/rest\s*:\s*(\d+)/i);
  return r ? parseInt(r[1], 10) : 90;
}

export class KineticEditModal extends Modal {
  private readonly opts: KineticEditOptions;
  private name = "Bench Press";
  private kind: ExerciseKind = "strength";
  private rest = 90;
  private unit: "lb" | "kg" = "lb";
  private isBodyweight = false;
  private sets: KineticSet[] = [];
  private markers: string[] = [];
  private progressSuffix = "";
  private sourcePath: string;

  private nameInput!: HTMLInputElement;
  private restLabel!: HTMLElement;
  private setsBody!: HTMLElement;
  private setsCountBadge!: HTMLElement;
  private kindBtns: Record<ExerciseKind, HTMLButtonElement> = {} as any;

  constructor(app: App, opts: KineticEditOptions) {
    super(app);
    this.opts = opts;
    this.sourcePath = opts.sourcePath ?? "vault://notes/workouts/chest-day.md";
    if (opts.raw) {
      this.hydrateFromRaw(opts.raw);
    } else {
      this.sets = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        kind: (i === 0 ? "warmup" : i === 2 ? "target" : i === 4 ? "drop" : "normal") as SetKind,
        prev: i === 0 ? "95 × 5" : i === 1 ? "135 × 5" : i === 2 ? "185 × 5" : i === 3 ? "185 × 5" : "155 × 8",
        weight: i === 0 ? 95 : i === 1 ? 135 : i === 2 ? 185 : i === 3 ? 185 : 155,
        reps: i === 4 ? 8 : 5,
        rpe: 6.5 + i * 0.7,
        done: i < 2,
      }));
    }
  }

  private hydrateFromRaw(raw: string): void {
    const ex = parseExerciseLine(raw);
    this.name = ex.name || "Bench Press";
    this.kind = ex.isStretch ? "stretch" : "strength";
    this.rest = ex.restSeconds || 90;
    this.progressSuffix = extractProgress(raw);
    this.markers = extractMarkers(raw);
    const first = ex.sets[0];
    if (first?.isBodyweight) {
      this.isBodyweight = true;
      this.unit = (first.addedWeight?.unit as "lb" | "kg") ?? "lb";
    } else if (first?.weight?.unit) {
      this.unit = first.weight.unit as "lb" | "kg";
    }
    if (ex.sets.length) {
      this.sets = ex.sets.map((s, i) => ({
        id: i + 1,
        kind: (i === 0 ? "warmup" : i === 2 ? "target" : i === ex.sets.length - 1 ? "drop" : "normal") as SetKind,
        prev: `${s.weight.value || 95} × ${s.reps || 5}`,
        weight: s.isBodyweight ? s.addedWeight?.value ?? 0 : s.weight.value,
        reps: s.reps || 5,
        rpe: 6.5 + i * 0.7,
        done: s.completed,
      }));
    } else {
      this.sets = Array.from({ length: 3 }, (_, i) => ({
        id: i + 1,
        kind: "normal" as SetKind,
        prev: "",
        weight: 100,
        reps: 5,
        rpe: 7,
        done: false,
      }));
    }
  }

  override onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass("kinetic-modal-host");
    contentEl.empty();
    contentEl.addClass("kinetic-root");

    // Backdrop scrim is handled by Obsidian; we add inner blur layer via CSS
    const wrapper = contentEl.createDiv({ cls: "kinetic-wrapper" });

    // === MOBILE DRAG HANDLE ===
    const handleBar = wrapper.createDiv({ cls: "kinetic-handle-bar" });
    handleBar.createDiv({ cls: "kinetic-drag-handle" });
    const crumb = handleBar.createDiv({ cls: "kinetic-crumb" });
    setIcon(crumb.createSpan({}), "diamond");
    crumb.createSpan({ text: "Obsidian Workout Logger • exercise.md" });

    // === DESKTOP WINDOW CHROME ===
    const chrome = wrapper.createDiv({ cls: "kinetic-chrome" });
    const chromeLeft = chrome.createDiv({ cls: "kinetic-chrome-left" });
    setIcon(chromeLeft.createSpan({ cls: "kinetic-chrome-diamond" }), "diamond");
    const crumbDesktop = chromeLeft.createDiv({ cls: "kinetic-chrome-crumb" });
    crumbDesktop.createSpan({ text: "Obsidian Workout Logger" });
    crumbDesktop.createSpan({ text: "/" });
    const crumbFile = crumbDesktop.createSpan({ text: "exercise.md" });
    crumbFile.addClass("kinetic-chrome-file");
    const chromeRight = chrome.createDiv({ cls: "kinetic-chrome-right" });
    const escBadge = chromeRight.createSpan({ text: "ESC", cls: "kinetic-kbd" });
    escBadge.addClass("kinetic-kbd-esc");
    const closeChrome = chromeRight.createEl("button", { attr: { "aria-label": "Close" }, cls: "kinetic-close-chrome" });
    setIcon(closeChrome, "x");
    closeChrome.addEventListener("click", () => this.close());

    // === TITLE HEADERS ===
    // Mobile header
    const mHeader = wrapper.createDiv({ cls: "kinetic-header kinetic-header-mobile" });
    const mTitleWrap = mHeader.createDiv();
    mTitleWrap.createEl("h1", { text: "Edit Exercise", cls: "kinetic-title" });
    mTitleWrap.createEl("p", { text: "Configure targets, volume & tracking metrics", cls: "kinetic-subtitle" });
    const mClose = mHeader.createEl("button", { cls: "kinetic-close-round", attr: { "aria-label": "Close" } });
    setIcon(mClose, "x");
    mClose.addEventListener("click", () => this.close());

    // Desktop header
    const dHeader = wrapper.createDiv({ cls: "kinetic-header kinetic-header-desktop" });
    const dTitleRow = dHeader.createDiv({ cls: "kinetic-title-row" });
    dTitleRow.createEl("h2", { text: "Edit Exercise", cls: "kinetic-title kinetic-title-lg" });
    dTitleRow.createEl("span", { text: this.sourcePath, cls: "kinetic-vault-path" });
    dHeader.createEl("p", { text: "Configure tracking parameters, targets & set structure for live sessions.", cls: "kinetic-subtitle" });

    // === SCROLLABLE BODY ===
    const body = wrapper.createDiv({ cls: "kinetic-body" });

    // --- Exercise Identity ---
    const identity = body.createDiv({ cls: "kinetic-section" });
    // Row: two-col on desktop, stacked on mobile (CSS grid)
    const topGrid = identity.createDiv({ cls: "kinetic-top-grid" });
    const leftCol = topGrid.createDiv({ cls: "kinetic-col" });

    // Name
    const nameGroup = leftCol.createDiv({ cls: "kinetic-field" });
    nameGroup.createEl("label", { text: "Exercise Name", cls: "kinetic-label" });
    const nameWrap = nameGroup.createDiv({ cls: "kinetic-input-wrap" });
    const iconWrap = nameWrap.createDiv({ cls: "kinetic-input-icon" });
    setIcon(iconWrap, "dumbbell");
    this.nameInput = nameWrap.createEl("input", { cls: "kinetic-input", attr: { placeholder: "e.g. Barbell Incline Press", spellcheck: "false" } });
    this.nameInput.value = this.name;
    this.nameInput.addEventListener("input", () => (this.name = this.nameInput.value));
    // suggestions
    const suggBox = nameWrap.createDiv({ cls: "kinetic-sugg" });
    suggBox.style.display = "none";
    const exercises = [...getExercises()].sort((a, b) => a.name.localeCompare(b.name));
    const updateSugg = () => {
      const q = this.nameInput.value.trim().toLowerCase();
      suggBox.empty();
      if (q.length < 2) { suggBox.style.display = "none"; return; }
      const filtered = exercises.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8);
      if (!filtered.length) { suggBox.style.display = "none"; return; }
      for (const e of filtered) {
        const it = suggBox.createDiv({ cls: "kinetic-sugg-item", text: e.name });
        it.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          this.name = e.name;
          this.nameInput.value = e.name;
          suggBox.style.display = "none";
        });
      }
      suggBox.style.display = "block";
    };
    this.nameInput.addEventListener("input", updateSugg);
    this.nameInput.addEventListener("focus", () => { if (this.nameInput.value.length >= 2) updateSugg(); });
    this.nameInput.addEventListener("blur", () => window.setTimeout(() => (suggBox.style.display = "none"), 150));
    this.nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); void this.handleSave(); }
      if (e.key === "Escape") suggBox.style.display = "none";
    });

    // Target muscles — static chips from design
    const muscleGroup = leftCol.createDiv({ cls: "kinetic-field" });
    muscleGroup.createEl("label", { text: "Target Muscles", cls: "kinetic-label" });
    const muscleRow = muscleGroup.createDiv({ cls: "kinetic-chips" });
    const chips = this.inferMuscles(this.name);
    for (const chip of chips) {
      const c = muscleRow.createSpan({ cls: "kinetic-chip" });
      c.setText(`#${chip}`);
      const x = c.createEl("button", { text: "×", cls: "kinetic-chip-x" });
      x.addEventListener("click", () => c.remove());
    }
    const addChip = muscleRow.createEl("button", { cls: "kinetic-chip-add" });
    setIcon(addChip.createSpan({}), "plus");
    addChip.createSpan({ text: " Add tag" });
    addChip.addEventListener("click", () => {
      const name = window.prompt("Muscle tag (e.g. chest)");
      if (name) {
        const c = document.createElement("span");
        c.className = "kinetic-chip";
        c.textContent = `#${name.replace(/^#/, "")}`;
        const x = document.createElement("button");
        x.className = "kinetic-chip-x";
        x.textContent = "×";
        x.addEventListener("click", () => c.remove());
        c.appendChild(x);
        muscleRow.insertBefore(c, addChip);
      }
    });

    // Exercise Type
    const typeGroup = leftCol.createDiv({ cls: "kinetic-field" });
    typeGroup.createEl("label", { text: "Exercise Type", cls: "kinetic-label" });
    const typeGrid = typeGroup.createDiv({ cls: "kinetic-type-grid" });
    const mkType = (k: ExerciseKind, label: string, icon: string) => {
      const b = typeGrid.createEl("button", { cls: "kinetic-type-btn" });
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(this.kind === k));
      if (this.kind === k) b.addClass("is-active");
      const ic = b.createSpan();
      setIcon(ic, icon as any);
      b.createSpan({ text: label });
      b.addEventListener("click", () => this.setKind(k));
      this.kindBtns[k] = b;
      return b;
    };
    mkType("strength", "Strength", "dumbbell");
    mkType("stretch", "Stretch", "person-standing");
    mkType("cardio", "Cardio", "zap");

    // Right col: Rest + Unit + Bodyweight
    const rightCol = topGrid.createDiv({ cls: "kinetic-col" });
    const restGroup = rightCol.createDiv({ cls: "kinetic-field" });
    const restLabelRow = restGroup.createDiv({ cls: "kinetic-label-row" });
    restLabelRow.createEl("label", { text: "Rest Duration (Seconds)", cls: "kinetic-label" });
    this.restLabel = restLabelRow.createSpan({ cls: "kinetic-rest-badge" });
    this.restLabel.setText(`${this.rest}s`);
    const restPresets = restGroup.createDiv({ cls: "kinetic-presets" });
    for (const v of [45, 60, 90, 120, 180]) {
      const b = restPresets.createEl("button", { text: `${v}s`, cls: "kinetic-preset" });
      if (v === this.rest) b.addClass("is-active");
      b.addEventListener("click", () => {
        this.rest = v;
        this.restLabel.setText(`${v}s`);
        restPresets.querySelectorAll(".kinetic-preset").forEach((el) => el.removeClass("is-active"));
        b.addClass("is-active");
      });
    }

    const unitRow = rightCol.createDiv({ cls: "kinetic-unit-row" });
    const unitGroup = unitRow.createDiv({ cls: "kinetic-field kinetic-field-half" });
    unitGroup.createEl("label", { text: "Weight Unit", cls: "kinetic-label" });
    const unitSeg = unitGroup.createDiv({ cls: "kinetic-seg" });
    const lbBtn = unitSeg.createEl("button", { text: "lb", cls: "kinetic-seg-btn" });
    const kgBtn = unitSeg.createEl("button", { text: "kg", cls: "kinetic-seg-btn" });
    const refreshUnit = () => {
      lbBtn.toggleClass("is-active", this.unit === "lb");
      kgBtn.toggleClass("is-active", this.unit === "kg");
    };
    refreshUnit();
    lbBtn.addEventListener("click", () => { this.unit = "lb"; refreshUnit(); });
    kgBtn.addEventListener("click", () => { this.unit = "kg"; refreshUnit(); });

    const bwGroup = unitRow.createDiv({ cls: "kinetic-field kinetic-field-half" });
    bwGroup.createEl("label", { text: "Tracking Mode", cls: "kinetic-label" });
    const bwBox = bwGroup.createDiv({ cls: "kinetic-bw-box" });
    bwBox.createSpan({ text: "Bodyweight", cls: "kinetic-bw-label" });
    const bwToggle = bwBox.createEl("input", { type: "checkbox", cls: "kinetic-bw-check" }) as HTMLInputElement;
    bwToggle.checked = this.isBodyweight;
    bwToggle.addEventListener("change", () => (this.isBodyweight = bwToggle.checked));

    // RPE helper (desktop)
    const rpeBox = rightCol.createDiv({ cls: "kinetic-rpe-box kinetic-desktop-only" });
    const rpeLeft = rpeBox.createDiv({ cls: "kinetic-rpe-left" });
    setIcon(rpeLeft.createSpan({}), "gauge");
    rpeLeft.createSpan({ text: "Track RPE & 1RM %" });
    rpeBox.createSpan({ text: "Active", cls: "kinetic-rpe-badge" });

    // === Global params mobile card (separate for mobile) ===
    // Already covered via rightCol but CSS will reflow

    // === Set Sequence Toolbar ===
    const seqBar = body.createDiv({ cls: "kinetic-seq-bar" });
    const seqLeft = seqBar.createDiv({ cls: "kinetic-seq-left" });
    seqLeft.createEl("span", { text: "Set Sequence", cls: "kinetic-seq-title" });
    this.setsCountBadge = seqLeft.createSpan({ cls: "kinetic-seq-badge" });
    this.setsCountBadge.setText(`${this.sets.length} Sets Total`);
    const seqActions = seqBar.createDiv({ cls: "kinetic-seq-actions" });
    const copyBtn = seqActions.createEl("button", { cls: "kinetic-seq-btn" });
    setIcon(copyBtn.createSpan({}), "copy");
    copyBtn.createSpan({ text: " Copy Weight All" });
    copyBtn.addEventListener("click", () => this.copyWeightToAll());
    const incBtn = seqActions.createEl("button", { cls: "kinetic-seq-btn kinetic-desktop-only" });
    setIcon(incBtn.createSpan({}), "plus");
    incBtn.createSpan({ text: " +5 lb Auto" });
    incBtn.addEventListener("click", () => this.autoIncrement(5));

    // Mobile secondary copy link
    const mobileCopy = body.createDiv({ cls: "kinetic-mobile-copy" });
    const mCopyLink = mobileCopy.createEl("button", { cls: "kinetic-link" });
    setIcon(mCopyLink.createSpan({}), "copy");
    mCopyLink.createSpan({ text: " Copy weight to all" });
    mCopyLink.addEventListener("click", () => this.copyWeightToAll());

    // === Sets Table ===
    const tableWrap = body.createDiv({ cls: "kinetic-table-wrap" });
    const tableHead = tableWrap.createDiv({ cls: "kinetic-table-head" });
    // Desktop: 7 cols, Mobile: 5 cols via CSS
    tableHead.createDiv({ text: "#", cls: "kinetic-th kinetic-th-idx" });
    tableHead.createDiv({ text: "Type", cls: "kinetic-th kinetic-th-type" });
    tableHead.createDiv({ text: "Prev Log", cls: "kinetic-th kinetic-th-prev" });
    tableHead.createDiv({ text: "Weight", cls: "kinetic-th" });
    tableHead.createDiv({ text: "Reps", cls: "kinetic-th" });
    tableHead.createDiv({ text: "RPE", cls: "kinetic-th kinetic-th-rpe" });
    tableHead.createDiv({ text: "Done", cls: "kinetic-th kinetic-th-done" });

    // Mobile head overlay (hidden on desktop)
    const mHead = tableWrap.createDiv({ cls: "kinetic-mhead" });
    mHead.createDiv({ text: "Set", cls: "kinetic-mhead-cell" });
    mHead.createDiv({ text: "Previous", cls: "kinetic-mhead-cell" });
    mHead.createDiv({ text: this.unit === "kg" ? "Kg" : "Lbs", cls: "kinetic-mhead-cell" });
    mHead.createDiv({ text: "Reps", cls: "kinetic-mhead-cell" });
    mHead.createDiv({ text: "✓", cls: "kinetic-mhead-cell kinetic-mhead-check" });

    this.setsBody = tableWrap.createDiv({ cls: "kinetic-table-body" });
    this.renderSets();

    const addBtn = body.createEl("button", { cls: "kinetic-add-btn" });
    setIcon(addBtn.createSpan({}), "plus");
    addBtn.createSpan({ text: ` Add Next Set` });
    const kbd = addBtn.createSpan({ text: this.sets.length >= 9 ? "" : "Ctrl + N", cls: "kinetic-kbd kinetic-kbd-add" });
    if (this.sets.length >= 12) addBtn.setAttribute("disabled", "true");
    addBtn.addEventListener("click", () => this.addSet());

    // Notes snippet
    const note = body.createDiv({ cls: "kinetic-note" });
    setIcon(note.createSpan({}), "hash");
    const noteText = note.createSpan({});
    noteText.innerHTML = `Logs automatically synced to <code>[[Workouts/2023-11.md]]</code>`;

    // === FOOTER ===
    const footer = wrapper.createDiv({ cls: "kinetic-footer" });
    const footLeft = footer.createDiv({ cls: "kinetic-foot-left" });
    const delBtn = footLeft.createEl("button", { cls: "kinetic-foot-del" });
    setIcon(delBtn.createSpan({}), "trash-2");
    delBtn.createSpan({ text: " Delete" });
    delBtn.addEventListener("click", async () => {
      if (this.opts.onDelete) await this.opts.onDelete();
      this.close();
    });
    const resetBtn = footLeft.createEl("button", { text: "Reset to default", cls: "kinetic-foot-reset" });
    resetBtn.addEventListener("click", () => this.resetToDefault());

    const footCenter = footer.createDiv({ cls: "kinetic-foot-center kinetic-desktop-only" });
    footCenter.createSpan({ text: "Tab", cls: "kinetic-kbd" });
    footCenter.createSpan({ text: " Next " });
    footCenter.createSpan({ text: "Enter", cls: "kinetic-kbd" });
    footCenter.createSpan({ text: " Done" });

    const footRight = footer.createDiv({ cls: "kinetic-foot-right" });
    const cancelBtn = footRight.createEl("button", { text: "Cancel", cls: "kinetic-btn kinetic-btn-ghost" });
    cancelBtn.addEventListener("click", () => this.close());
    const saveBtn = footRight.createEl("button", { cls: "kinetic-btn kinetic-btn-primary" });
    saveBtn.createSpan({ text: "Save Changes" });
    const saveKbd = saveBtn.createSpan({ text: "Ctrl+S", cls: "kinetic-kbd kinetic-kbd-save" });
    saveBtn.addEventListener("click", () => void this.handleSave());

    // Keyboard shortcuts
    wrapper.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void this.handleSave(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") { e.preventDefault(); this.addSet(); }
      if (e.key === "Escape") this.close();
    });
    // focus first input
    window.setTimeout(() => this.nameInput.focus(), 50);
  }

  private inferMuscles(name: string): string[] {
    const lower = name.toLowerCase();
    if (lower.includes("bench") || lower.includes("press")) return ["chest", "front-delts", "triceps"];
    if (lower.includes("squat")) return ["quads", "glutes"];
    if (lower.includes("deadlift")) return ["hamstrings", "back"];
    return ["chest", "triceps"];
  }

  private setKind(k: ExerciseKind): void {
    this.kind = k;
    (Object.keys(this.kindBtns) as ExerciseKind[]).forEach((kk) => {
      const is = kk === k;
      this.kindBtns[kk].toggleClass("is-active", is);
      this.kindBtns[kk].setAttribute("aria-checked", String(is));
    });
    // Stretch uses seconds, but we keep reps field as hold duration
    this.renderSets();
  }

  private renderSets(): void {
    if (!this.setsBody) return;
    this.setsBody.empty();
    this.sets.forEach((s, idx) => {
      const row = this.setsBody.createDiv({ cls: "kinetic-row" });
      if (idx % 2 === 1) row.addClass("is-alt");
      if (s.done) row.addClass("is-done");

      // #
      const idxCell = row.createDiv({ cls: "kinetic-cell kinetic-cell-idx" });
      const badge = idxCell.createSpan({ text: String(s.id), cls: "kinetic-idx-badge" });
      if (s.kind === "target") badge.addClass("is-target");
      else if (s.kind === "warmup") badge.addClass("is-warmup");

      // Type
      const typeCell = row.createDiv({ cls: "kinetic-cell kinetic-cell-type" });
      const typePill = typeCell.createSpan({ text: s.kind.toUpperCase(), cls: "kinetic-type-pill" });
      typePill.addClass(`kind-${s.kind}`);
      typePill.addEventListener("click", () => {
        const order: SetKind[] = ["warmup", "normal", "target", "drop"];
        const cur = order.indexOf(s.kind);
        s.kind = order[(cur + 1) % order.length];
        this.renderSets();
      });

      // Prev
      const prevCell = row.createDiv({ cls: "kinetic-cell kinetic-cell-prev" });
      prevCell.setText(s.prev || "—");
      prevCell.addClass("kinetic-prev");

      // Weight stepper
      const wCell = row.createDiv({ cls: "kinetic-cell kinetic-cell-weight" });
      const wWrap = wCell.createDiv({ cls: "kinetic-stepper" });
      const wMinus = wWrap.createEl("button", { text: "−", cls: "kinetic-step-btn" });
      const wInput = wWrap.createEl("input", { type: "text", cls: "kinetic-step-input" });
      wInput.value = String(s.weight);
      wInput.setAttribute("inputmode", "decimal");
      const wPlus = wWrap.createEl("button", { text: "+", cls: "kinetic-step-btn" });
      wMinus.addEventListener("click", () => { s.weight = clamp(Math.round((s.weight - 5) * 100) / 100, -200, 1000); wInput.value = String(s.weight); });
      wPlus.addEventListener("click", () => { s.weight = clamp(Math.round((s.weight + 5) * 100) / 100, -200, 1000); wInput.value = String(s.weight); });
      wInput.addEventListener("input", () => {
        const v = parseFloat(wInput.value);
        if (!Number.isNaN(v)) s.weight = clamp(v, -200, 1000);
      });
      wInput.addEventListener("change", () => { wInput.value = String(clamp(parseFloat(wInput.value) || 0, -200, 1000)); s.weight = parseFloat(wInput.value); });

      // Reps stepper
      const rCell = row.createDiv({ cls: "kinetic-cell kinetic-cell-reps" });
      const rWrap = rCell.createDiv({ cls: "kinetic-stepper kinetic-stepper-sm" });
      const rMinus = rWrap.createEl("button", { text: "−", cls: "kinetic-step-btn" });
      const rInput = rWrap.createEl("input", { type: "text", cls: "kinetic-step-input" });
      rInput.value = String(s.reps);
      rInput.setAttribute("inputmode", "numeric");
      const rPlus = rWrap.createEl("button", { text: "+", cls: "kinetic-step-btn" });
      rMinus.addEventListener("click", () => { s.reps = clamp(s.reps - 1, 0, 50); rInput.value = String(s.reps); });
      rPlus.addEventListener("click", () => { s.reps = clamp(s.reps + 1, 0, 50); rInput.value = String(s.reps); });
      rInput.addEventListener("input", () => {
        const v = parseInt(rInput.value, 10);
        if (!Number.isNaN(v)) s.reps = clamp(v, 0, 50);
      });
      rInput.addEventListener("change", () => { rInput.value = String(clamp(parseInt(rInput.value, 10) || 0, 0, 50)); s.reps = parseInt(rInput.value, 10); });

      // RPE
      const rpeCell = row.createDiv({ cls: "kinetic-cell kinetic-cell-rpe" });
      rpeCell.setText(s.rpe.toFixed(1));
      rpeCell.addEventListener("click", () => {
        const v = window.prompt("RPE (6-10)", String(s.rpe));
        if (v != null) {
          const n = parseFloat(v);
          if (!Number.isNaN(n)) { s.rpe = clamp(Math.round(n * 2) / 2, 6, 10); this.renderSets(); }
        }
      });

      // Done
      const doneCell = row.createDiv({ cls: "kinetic-cell kinetic-cell-done" });
      const doneBtn = doneCell.createEl("button", { cls: "kinetic-done-btn" });
      if (s.done) doneBtn.addClass("is-checked");
      const ic = doneBtn.createSpan();
      setIcon(ic, s.done ? "check" : "check");
      if (!s.done) doneBtn.addClass("is-unchecked");
      doneBtn.addEventListener("click", () => {
        s.done = !s.done;
        this.renderSets();
      });
    });
    if (this.setsCountBadge) this.setsCountBadge.setText(`${this.sets.length} Sets Total`);
  }

  private copyWeightToAll(): void {
    if (!this.sets.length) return;
    const first = this.sets[0].weight;
    for (let i = 1; i < this.sets.length; i++) this.sets[i].weight = first;
    this.renderSets();
    new Notice(`Copied ${first}${this.unit} to all sets`);
  }

  private autoIncrement(delta: number): void {
    this.sets.forEach((s) => (s.weight += delta));
    this.renderSets();
    new Notice(`+${delta}${this.unit} to all sets`);
  }

  private addSet(): void {
    if (this.sets.length >= 12) return;
    const last = this.sets[this.sets.length - 1];
    this.sets.push({
      id: this.sets.length + 1,
      kind: "normal",
      prev: last ? `${last.weight} × ${last.reps}` : "",
      weight: last?.weight ?? 100,
      reps: last?.reps ?? 5,
      rpe: last?.rpe ?? 8,
      done: false,
    });
    this.renderSets();
  }

  private resetToDefault(): void {
    this.sets = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      kind: (i === 0 ? "warmup" : i === 2 ? "target" : i === 4 ? "drop" : "normal") as SetKind,
      prev: i === 0 ? "95 × 5" : i === 1 ? "135 × 5" : i === 2 ? "185 × 5" : i === 3 ? "185 × 5" : "155 × 8",
      weight: i === 0 ? 95 : i === 1 ? 135 : i === 2 ? 185 : i === 3 ? 185 : 155,
      reps: i === 4 ? 8 : 5,
      rpe: 6.5 + i * 0.7,
      done: i < 2,
    }));
    this.rest = 90;
    this.unit = "lb";
    this.isBodyweight = false;
    if (this.restLabel) this.restLabel.setText("90s");
    this.renderSets();
    new Notice("Reset to default");
  }

  private buildLine(): string | null {
    const name = this.name.trim();
    if (!name) { new Notice("Enter an exercise name."); this.nameInput.focus(); return null; }
    if (this.kind === "stretch") {
      const hold = this.sets[0]?.reps ?? 45;
      const count = this.sets.length;
      const markers = this.applyMarkers(count);
      const spec = this.rest > 0 ? `${count}x${hold}s|${this.rest}s` : `${count}x${hold}s`;
      const tag = name.toLowerCase().includes("stretch") ? "" : ", type: stretch";
      return `${markers} ${name} / ${spec}${tag}${this.progressSuffix ? ", " + this.progressSuffix.replace(/^,\s*/, "") : ""}`;
    }
    if (this.kind === "cardio") {
      const hold = this.sets[0]?.reps ?? 600;
      const count = this.sets.length;
      const markers = this.applyMarkers(count);
      const spec = `${count}x${hold}s`;
      return `${markers} ${name} / ${spec}, type: stretch${this.progressSuffix ? ", " + this.progressSuffix.replace(/^,\s*/, "") : ""}`;
    }
    const markers = this.applyMarkers(this.sets.length);
    const tokens = this.sets.map((s) => {
      if (this.isBodyweight) {
        if (s.weight === 0) return `${s.reps}xbw`;
        if (s.weight > 0) return `${s.reps}xbw+${s.weight}${this.unit}`;
        return `${s.reps}xbw${s.weight}${this.unit}`;
      }
      return `${s.reps}x${s.weight}${this.unit}`;
    }).join(", ");
    const restPart = this.rest > 0 ? `, rest: ${this.rest}` : "";
    const prog = this.progressSuffix ? (this.progressSuffix.startsWith(",") ? this.progressSuffix : ", " + this.progressSuffix.replace(/^,\s*/, "")) : "";
    return `${markers} ${name} / ${tokens}${restPart}${prog}`;
  }

  private applyMarkers(count: number): string {
    if (this.markers.length) {
      const out = this.markers.slice(0, count);
      while (out.length < count) out.push("[ ]");
      return out.join(" ");
    }
    return Array(count).fill("[ ]").join(" ");
  }

  private async handleSave(): Promise<void> {
    const line = this.buildLine();
    if (!line) return;
    this.close();
    await this.opts.onSave(line);
  }

  override onClose(): void {
    this.contentEl.empty();
    const host = document.querySelector(".kinetic-modal-host") as HTMLElement | null;
    host?.removeClass("kinetic-modal-host");
  }
}
