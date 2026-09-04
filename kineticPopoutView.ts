import { App, ItemView, Platform, WorkspaceLeaf, setIcon } from "obsidian";
import { findExercise, getExercises } from "./exerciseDb";
import { parseExerciseLine } from "./parser";
import { KineticEditModal, type KineticEditOptions } from "./kineticEditModal";

/**
 * kineticPopoutView.ts — Desktop popout window for Kinetic Edit
 *
 * Stitch desktop is a separate window (header chrome, 960-1020 wide, not a
 * constrained modal). Mobile stays as Modal. This ItemView hosts the same
 * Kinetic UI but inside an Obsidian popout WorkspaceLeaf (openPopoutLeaf),
 * so the user gets a resizable OS window for sizing.
 *
 * View type: "kinetic-edit"
 */

export const KINETIC_VIEW_TYPE = "kinetic-edit";

// Pending callbacks keyed by leaf id — ViewStateResult is string-serializable,
// so we store the actual onSave/onDelete closures here.
const pending = new Map<string, KineticEditOptions>();

export function setPendingKinetic(leafId: string, opts: KineticEditOptions): void {
  pending.set(leafId, opts);
}
export function popPendingKinetic(leafId: string): KineticEditOptions | undefined {
  const v = pending.get(leafId);
  pending.delete(leafId);
  return v;
}

/** Shared builder — extracted from KineticEditModal.onOpen for reuse in popout. */
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

function resolveMuscles(name: string): string[] {
  const ex = findExercise(name);
  if (ex && (ex.primaryMuscles?.length || ex.secondaryMuscles?.length)) {
    const combined = [...(ex.primaryMuscles ?? []), ...(ex.secondaryMuscles ?? [])];
    const norm = combined.map((m) => m.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean);
    return [...new Set(norm)].slice(0, 4);
  }
  const lower = name.toLowerCase();
  if (lower.includes("bench") || lower.includes("press")) return ["chest", "front-delts", "triceps"];
  if (lower.includes("squat")) return ["quads", "glutes"];
  if (lower.includes("deadlift")) return ["hamstrings", "back"];
  return ["chest", "triceps"];
}

export class KineticPopoutView extends ItemView {
  private opts: KineticEditOptions | null = null;
  private leafId: string;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.leafId = (leaf as any).id ?? Math.random().toString(36).slice(2);
  }

  override getViewType(): string {
    return KINETIC_VIEW_TYPE;
  }
  override getDisplayText(): string {
    return "Edit Exercise";
  }
  override getIcon(): string {
    return "dumbbell";
  }

  override async setState(state: any, result: any): Promise<void> {
    // state may carry { pendingId } or raw/sourcePath directly
    if (state?.pendingId) {
      this.opts = popPendingKinetic(state.pendingId) ?? null;
    } else if (state?.raw || state?.sourcePath) {
      this.opts = { raw: state.raw, sourcePath: state.sourcePath, onSave: async () => {}, onDelete: async () => {} };
    }
    await super.setState(state, result);
  }

  override async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("kinetic-popout-root");
    container.addClass("kinetic-root");

    // opts may have been set via setState or pending map fallback
    if (!this.opts) {
      const fallback = pending.values().next().value as KineticEditOptions | undefined;
      if (fallback) {
        this.opts = fallback;
        // clear one
        const firstKey = pending.keys().next().value;
        if (firstKey) pending.delete(firstKey);
      }
    }
    if (!this.opts) {
      container.createEl("p", { text: "No exercise data.", cls: "kinetic-subtitle" });
      return;
    }
    this.build(container, this.opts);
  }

  override async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  private build(container: HTMLElement, opts: KineticEditOptions): void {
    // Re-use KineticEditModal's UI but rendered into popout leaf
    // State
    let name = "Bench Press";
    let kind: ExerciseKind = "strength";
    let rest = 90;
    let unit: "lb" | "kg" = "lb";
    let isBodyweight = false;
    let sets: KineticSet[] = [];
    let markers: string[] = [];
    let progressSuffix = "";
    const sourcePath = opts.sourcePath ?? "vault://notes/workouts/chest-day.md";

    const hydrate = (raw: string) => {
      const ex = parseExerciseLine(raw);
      name = ex.name || "Bench Press";
      kind = ex.isStretch ? "stretch" : "strength";
      rest = ex.restSeconds || 90;
      progressSuffix = extractProgress(raw);
      markers = extractMarkers(raw);
      const first = ex.sets[0];
      if (first?.isBodyweight) {
        isBodyweight = true;
        unit = (first.addedWeight?.unit as "lb" | "kg") ?? "lb";
      } else if (first?.weight?.unit) unit = first.weight.unit as "lb" | "kg";
      if (ex.sets.length) {
        sets = ex.sets.map((s, i) => ({
          id: i + 1,
          kind: (i === 0 ? "warmup" : i === 2 ? "target" : i === ex.sets.length - 1 ? "drop" : "normal") as SetKind,
          prev: `${s.weight.value || 95} × ${s.reps || 5}`,
          weight: s.isBodyweight ? s.addedWeight?.value ?? 0 : s.weight.value,
          reps: s.reps || 5,
          rpe: 6.5 + i * 0.7,
          done: s.completed,
        }));
      } else sets = Array.from({ length: 3 }, (_, i) => ({ id: i + 1, kind: "normal" as SetKind, prev: "", weight: 100, reps: 5, rpe: 7, done: false }));
    };
    if (opts.raw) hydrate(opts.raw);
    else sets = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, kind: (i === 0 ? "warmup" : i === 2 ? "target" : i === 4 ? "drop" : "normal") as SetKind, prev: i === 0 ? "95 × 5" : i === 1 ? "135 × 5" : i === 2 ? "185 × 5" : i === 3 ? "185 × 5" : "155 × 8", weight: i === 0 ? 95 : i === 1 ? 135 : i === 2 ? 185 : i === 3 ? 185 : 155, reps: i === 4 ? 8 : 5, rpe: 6.5 + i * 0.7, done: i < 2 }));

    const wrapper = container.createDiv({ cls: "kinetic-wrapper" });

    // Chrome
    const chrome = wrapper.createDiv({ cls: "kinetic-chrome" });
    const chromeLeft = chrome.createDiv({ cls: "kinetic-chrome-left" });
    setIcon(chromeLeft.createSpan({ cls: "kinetic-chrome-diamond" }), "diamond");
    const crumbDesktop = chromeLeft.createDiv({ cls: "kinetic-chrome-crumb" });
    crumbDesktop.createSpan({ text: "Obsidian Workout Logger" });
    crumbDesktop.createSpan({ text: "/" });
    const crumbFile = crumbDesktop.createSpan({ text: "liftoscript" });
    crumbFile.addClass("kinetic-chrome-file");
    const chromeRight = chrome.createDiv({ cls: "kinetic-chrome-right" });
    const escBadge = chromeRight.createSpan({ text: "ESC", cls: "kinetic-kbd" });
    escBadge.addClass("kinetic-kbd-esc");
    const closeChrome = chromeRight.createEl("button", { attr: { "aria-label": "Close" }, cls: "kinetic-close-chrome" });
    setIcon(closeChrome, "x");
    const closeView = () => this.leaf.detach();
    closeChrome.addEventListener("click", closeView);

    const dHeader = wrapper.createDiv({ cls: "kinetic-header kinetic-header-desktop" });
    dHeader.createEl("h2", { text: "Edit Exercise", cls: "kinetic-title kinetic-title-lg" });
    dHeader.createEl("p", { text: "Configure tracking parameters, targets & set structure for live sessions.", cls: "kinetic-subtitle" });

    const body = wrapper.createDiv({ cls: "kinetic-body" });

    // Top grid — same as modal
    const topGrid = body.createDiv({ cls: "kinetic-top-grid" });
    const leftCol = topGrid.createDiv({ cls: "kinetic-col" });
    const nameGroup = leftCol.createDiv({ cls: "kinetic-field" });
    nameGroup.createEl("label", { text: "Exercise Name", cls: "kinetic-label" });
    const nameWrap = nameGroup.createDiv({ cls: "kinetic-input-wrap" });
    const iconWrap = nameWrap.createDiv({ cls: "kinetic-input-icon" });
    setIcon(iconWrap, "dumbbell");
    const nameInput = nameWrap.createEl("input", { cls: "kinetic-input", attr: { placeholder: "e.g. Barbell Incline Press", spellcheck: "false" } }) as HTMLInputElement;
    nameInput.value = name;
    nameInput.addEventListener("input", () => (name = nameInput.value));
    const suggBox = nameWrap.createDiv({ cls: "kinetic-sugg" });
    suggBox.style.display = "none";
    const exercises = [...getExercises()].sort((a, b) => a.name.localeCompare(b.name));
    const updateSugg = () => {
      const q = nameInput.value.trim().toLowerCase();
      suggBox.empty();
      if (q.length < 2) { suggBox.style.display = "none"; return; }
      const filtered = exercises.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8);
      if (!filtered.length) { suggBox.style.display = "none"; return; }
      for (const e of filtered) {
        const it = suggBox.createDiv({ cls: "kinetic-sugg-item", text: e.name });
        it.addEventListener("mousedown", (ev) => { ev.preventDefault(); name = e.name; nameInput.value = e.name; suggBox.style.display = "none"; syncMusclesFromName(); });
      }
      suggBox.style.display = "block";
    };
    nameInput.addEventListener("input", updateSugg);
    nameInput.addEventListener("focus", () => { if (nameInput.value.length >= 2) updateSugg(); });
    nameInput.addEventListener("blur", () => window.setTimeout(() => (suggBox.style.display = "none"), 150));
    const arrow = nameWrap.createDiv({ cls: "kinetic-input-arrow" });
    setIcon(arrow, "chevron-down");
    arrow.setAttribute("aria-label", "Show exercises");
    arrow.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (suggBox.style.display === "none" || !suggBox.style.display) {
        suggBox.empty();
        const all = [...getExercises()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 20);
        for (const ex of all) {
          const it = suggBox.createDiv({ cls: "kinetic-sugg-item", text: ex.name });
          it.addEventListener("mousedown", (ev) => { ev.preventDefault(); name = ex.name; nameInput.value = ex.name; suggBox.style.display = "none"; syncMusclesFromName(); });
        }
        suggBox.style.display = "block";
        nameInput.focus();
      } else suggBox.style.display = "none";
    });

    const muscleGroup = leftCol.createDiv({ cls: "kinetic-field" });
    muscleGroup.createEl("label", { text: "Target Muscles", cls: "kinetic-label" });
    const muscleRow = muscleGroup.createDiv({ cls: "kinetic-chips" });
    let muscleChips: string[] = resolveMuscles(name);
    const renderMuscleChips = () => {
      const addBtn = muscleRow.querySelector(".kinetic-chip-add") as HTMLElement | null;
      muscleRow.querySelectorAll(".kinetic-chip").forEach((el) => el.remove());
      for (const chip of muscleChips) {
        const c = document.createElement("span");
        c.className = "kinetic-chip";
        c.textContent = `#${chip}`;
        const x = document.createElement("button");
        x.className = "kinetic-chip-x";
        x.textContent = "×";
        x.addEventListener("click", () => { muscleChips = muscleChips.filter((m) => m !== chip); c.remove(); });
        c.appendChild(x);
        if (addBtn) muscleRow.insertBefore(c, addBtn);
        else muscleRow.appendChild(c);
      }
    };
    const addChip = muscleRow.createEl("button", { cls: "kinetic-chip-add" });
    setIcon(addChip.createSpan({}), "plus");
    addChip.createSpan({ text: " Add tag" });
    addChip.addEventListener("click", () => {
      const n = window.prompt("Muscle tag (e.g. chest)");
      if (n) { const clean = n.replace(/^#/, "").trim().toLowerCase(); if (clean && !muscleChips.includes(clean)) { muscleChips.push(clean); renderMuscleChips(); } }
    });
    renderMuscleChips();
    const syncMusclesFromName = () => { muscleChips = resolveMuscles(name); renderMuscleChips(); };
    nameInput.addEventListener("input", syncMusclesFromName);
    suggBox.addEventListener("mousedown", () => window.setTimeout(syncMusclesFromName, 0));

    const typeGroup = leftCol.createDiv({ cls: "kinetic-field" });
    typeGroup.createEl("label", { text: "Exercise Type", cls: "kinetic-label" });
    const typeGrid = typeGroup.createDiv({ cls: "kinetic-type-grid" });
    const kindBtns: Record<string, HTMLButtonElement> = {};
    const mkType = (k: ExerciseKind, label: string, icon: string) => {
      const b = typeGrid.createEl("button", { cls: "kinetic-type-btn" });
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(kind === k));
      if (kind === k) b.addClass("is-active");
      const ic = b.createSpan();
      setIcon(ic, icon as any);
      b.createSpan({ text: label });
      b.addEventListener("click", () => { kind = k as ExerciseKind; Object.keys(kindBtns).forEach((kk) => { const is = kk === k; kindBtns[kk].toggleClass("is-active", is); kindBtns[kk].setAttribute("aria-checked", String(is)); }); renderSets(); });
      kindBtns[k] = b;
      return b;
    };
    mkType("strength", "Strength", "dumbbell");
    mkType("stretch", "Stretch", "person-standing");
    // TODO(cardio) hidden

    const rightCol = topGrid.createDiv({ cls: "kinetic-col" });
    const restGroup = rightCol.createDiv({ cls: "kinetic-field" });
    const restLabelRow = restGroup.createDiv({ cls: "kinetic-label-row" });
    restLabelRow.createEl("label", { text: "Rest Duration (Seconds)", cls: "kinetic-label" });
    const restLabel = restLabelRow.createSpan({ cls: "kinetic-rest-badge" });
    restLabel.setText(`${rest}s`);
    const restPresets = restGroup.createDiv({ cls: "kinetic-presets" });
    for (const v of [45, 60, 90, 120, 180]) {
      const b = restPresets.createEl("button", { text: `${v}s`, cls: "kinetic-preset" });
      if (v === rest) b.addClass("is-active");
      b.addEventListener("click", () => { rest = v; restLabel.setText(`${v}s`); restPresets.querySelectorAll(".kinetic-preset").forEach((el) => el.removeClass("is-active")); b.addClass("is-active"); });
    }
    const unitRow = rightCol.createDiv({ cls: "kinetic-unit-row" });
    const unitGroup = unitRow.createDiv({ cls: "kinetic-field kinetic-field-half" });
    unitGroup.createEl("label", { text: "Weight Unit", cls: "kinetic-label" });
    const unitSeg = unitGroup.createDiv({ cls: "kinetic-seg" });
    const lbBtn = unitSeg.createEl("button", { text: "lb", cls: "kinetic-seg-btn" });
    const kgBtn = unitSeg.createEl("button", { text: "kg", cls: "kinetic-seg-btn" });
    const refreshUnit = () => { lbBtn.toggleClass("is-active", unit === "lb"); kgBtn.toggleClass("is-active", unit === "kg"); };
    refreshUnit();
    lbBtn.addEventListener("click", () => { unit = "lb"; refreshUnit(); });
    kgBtn.addEventListener("click", () => { unit = "kg"; refreshUnit(); });
    const bwGroup = unitRow.createDiv({ cls: "kinetic-field kinetic-field-half" });
    bwGroup.createEl("label", { text: "Tracking Mode", cls: "kinetic-label" });
    const bwBox = bwGroup.createDiv({ cls: "kinetic-bw-box" });
    bwBox.createSpan({ text: "Bodyweight", cls: "kinetic-bw-label" });
    const bwToggle = bwBox.createEl("input", { type: "checkbox", cls: "kinetic-bw-check" }) as HTMLInputElement;
    bwToggle.checked = isBodyweight;
    bwToggle.addEventListener("change", () => (isBodyweight = bwToggle.checked));

    const seqBar = body.createDiv({ cls: "kinetic-seq-bar" });
    const seqLeft = seqBar.createDiv({ cls: "kinetic-seq-left" });
    seqLeft.createEl("span", { text: "Set Sequence", cls: "kinetic-seq-title" });
    const setsCountBadge = seqLeft.createSpan({ cls: "kinetic-seq-badge" });
    setsCountBadge.setText(`${sets.length} Sets Total`);
    const seqActions = seqBar.createDiv({ cls: "kinetic-seq-actions" });
    const copyBtn = seqActions.createEl("button", { cls: "kinetic-seq-btn" });
    setIcon(copyBtn.createSpan({}), "copy");
    copyBtn.createSpan({ text: " Copy Weight All" });
    copyBtn.addEventListener("click", () => copyWeightToAll());
    const incBtn = seqActions.createEl("button", { cls: "kinetic-seq-btn" });
    setIcon(incBtn.createSpan({}), "plus");
    incBtn.createSpan({ text: " +5 lb Auto" });
    incBtn.addEventListener("click", () => autoIncrement(5));

    const tableWrap = body.createDiv({ cls: "kinetic-table-wrap" });
    const tableHead = tableWrap.createDiv({ cls: "kinetic-table-head" });
    // 5 cols after Type+Prev removal
    tableHead.createDiv({ text: "#", cls: "kinetic-th kinetic-th-idx" });
    tableHead.createDiv({ text: "Weight", cls: "kinetic-th" });
    tableHead.createDiv({ text: "Reps", cls: "kinetic-th" });
    tableHead.createDiv({ text: "Done", cls: "kinetic-th kinetic-th-done" });
    tableHead.createDiv({ text: "", cls: "kinetic-th kinetic-th-remove" });
    const setsBody = tableWrap.createDiv({ cls: "kinetic-table-body" });
    const renderSets = () => {
      setsBody.empty();
      sets.forEach((s, idx) => {
        const row = setsBody.createDiv({ cls: "kinetic-row" });
        if (idx % 2 === 1) row.addClass("is-alt");
        if (s.done) row.addClass("is-done");
        const idxCell = row.createDiv({ cls: "kinetic-cell kinetic-cell-idx" });
        const badge = idxCell.createSpan({ text: String(s.id), cls: "kinetic-idx-badge" });
        if (s.kind === "target") badge.addClass("is-target");
        const wCell = row.createDiv({ cls: "kinetic-cell kinetic-cell-weight" });
        const wWrap = wCell.createDiv({ cls: "kinetic-stepper" });
        const wMinus = wWrap.createEl("button", { text: "−", cls: "kinetic-step-btn" });
        const wInput = wWrap.createEl("input", { type: "text", cls: "kinetic-step-input" }) as HTMLInputElement;
        wInput.value = String(s.weight);
        const wPlus = wWrap.createEl("button", { text: "+", cls: "kinetic-step-btn" });
        wMinus.addEventListener("click", () => { s.weight = clamp(Math.round((s.weight - 5) * 100) / 100, -200, 1000); wInput.value = String(s.weight); });
        wPlus.addEventListener("click", () => { s.weight = clamp(Math.round((s.weight + 5) * 100) / 100, -200, 1000); wInput.value = String(s.weight); });
        wInput.addEventListener("input", () => { const v = parseFloat(wInput.value); if (!Number.isNaN(v)) s.weight = clamp(v, -200, 1000); });
        const rCell = row.createDiv({ cls: "kinetic-cell kinetic-cell-reps" });
        const rWrap = rCell.createDiv({ cls: "kinetic-stepper kinetic-stepper-sm" });
        const rMinus = rWrap.createEl("button", { text: "−", cls: "kinetic-step-btn" });
        const rInput = rWrap.createEl("input", { type: "text", cls: "kinetic-step-input" }) as HTMLInputElement;
        rInput.value = String(s.reps);
        const rPlus = rWrap.createEl("button", { text: "+", cls: "kinetic-step-btn" });
        rMinus.addEventListener("click", () => { s.reps = clamp(s.reps - 1, 0, 50); rInput.value = String(s.reps); });
        rPlus.addEventListener("click", () => { s.reps = clamp(s.reps + 1, 0, 50); rInput.value = String(s.reps); });
        rInput.addEventListener("input", () => { const v = parseInt(rInput.value, 10); if (!Number.isNaN(v)) s.reps = clamp(v, 0, 50); });
        const doneCell = row.createDiv({ cls: "kinetic-cell kinetic-cell-done" });
        const doneBtn = doneCell.createEl("button", { cls: "kinetic-done-btn" });
        if (s.done) doneBtn.addClass("is-checked");
        const ic = doneBtn.createSpan();
        setIcon(ic, "check");
        if (!s.done) doneBtn.addClass("is-unchecked");
        doneBtn.addEventListener("click", () => { s.done = !s.done; renderSets(); });
        const removeCell = row.createDiv({ cls: "kinetic-cell kinetic-cell-remove" });
        const removeBtn = removeCell.createEl("button", { cls: "kinetic-remove-btn", attr: { "aria-label": "Delete set" } });
        setIcon(removeBtn, "trash-2");
        if (sets.length <= 1) { removeBtn.setAttribute("disabled", "true"); removeBtn.addClass("is-disabled"); }
        removeBtn.addEventListener("click", () => { if (sets.length <= 1) return; sets.splice(idx, 1); sets.forEach((set, i) => (set.id = i + 1)); renderSets(); });
      });
      setsCountBadge.setText(`${sets.length} Sets Total`);
    };
    const copyWeightToAll = () => { if (!sets.length) return; const first = sets[0].weight; for (let i = 1; i < sets.length; i++) sets[i].weight = first; renderSets(); };
    const autoIncrement = (delta: number) => { sets.forEach((s) => (s.weight += delta)); renderSets(); };
    renderSets();
    const addBtn = body.createEl("button", { cls: "kinetic-add-btn" });
    setIcon(addBtn.createSpan({}), "plus");
    addBtn.createSpan({ text: ` Add Next Set` });
    addBtn.addEventListener("click", () => { if (sets.length >= 12) return; const last = sets[sets.length - 1]; sets.push({ id: sets.length + 1, kind: "normal", prev: last ? `${last.weight} × ${last.reps}` : "", weight: last?.weight ?? 100, reps: last?.reps ?? 5, rpe: 7, done: false }); renderSets(); });
    const note = body.createDiv({ cls: "kinetic-note" });
    setIcon(note.createSpan({}), "hash");
    const noteText = note.createSpan({});
    const displayPath = sourcePath.replace(/^vault:\/\//, "");
    noteText.innerHTML = `Logs automatically synced to <code>[[${displayPath}]]</code>`;

    const footer = wrapper.createDiv({ cls: "kinetic-footer" });
    const footLeft = footer.createDiv({ cls: "kinetic-foot-left" });
    const delBtn = footLeft.createEl("button", { cls: "kinetic-foot-del" });
    setIcon(delBtn.createSpan({}), "trash-2");
    delBtn.createSpan({ text: " Delete" });
    delBtn.addEventListener("click", async () => { if (opts.onDelete) await opts.onDelete(); this.leaf.detach(); });
    const resetBtn = footLeft.createEl("button", { text: "Reset to default", cls: "kinetic-foot-reset" });
    resetBtn.addEventListener("click", () => { sets = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, kind: (i === 0 ? "warmup" : i === 2 ? "target" : i === 4 ? "drop" : "normal") as SetKind, prev: i === 0 ? "95 × 5" : i === 1 ? "135 × 5" : i === 2 ? "185 × 5" : i === 3 ? "185 × 5" : "155 × 8", weight: i === 0 ? 95 : i === 1 ? 135 : i === 2 ? 185 : i === 3 ? 185 : 155, reps: i === 4 ? 8 : 5, rpe: 7, done: i < 2 })); rest = 90; unit = "lb"; isBodyweight = false; (restLabel as any).setText?.("90s"); renderSets(); });
    const footRight = footer.createDiv({ cls: "kinetic-foot-right" });
    const cancelBtn = footRight.createEl("button", { text: "Cancel", cls: "kinetic-btn kinetic-btn-ghost" });
    cancelBtn.addEventListener("click", () => this.leaf.detach());
    const saveBtn = footRight.createEl("button", { cls: "kinetic-btn kinetic-btn-primary" });
    saveBtn.createSpan({ text: "Save Changes" });
    saveBtn.createSpan({ text: "Ctrl+S", cls: "kinetic-kbd kinetic-kbd-save" });
    const handleSave = async () => {
      const n = name.trim();
      if (!n) return;
      let line: string;
      if (kind === "stretch") { const hold = sets[0]?.reps ?? 45; const count = sets.length; const markersStr = markers.length ? markers.slice(0, count).concat(Array(Math.max(0, count - markers.length)).fill("[ ]")).join(" ") : Array(count).fill("[ ]").join(" "); const spec = rest > 0 ? `${count}x${hold}s|${rest}s` : `${count}x${hold}s`; const tag = n.toLowerCase().includes("stretch") ? "" : ", type: stretch"; line = `${markersStr} ${n} / ${spec}${tag}${progressSuffix ? ", " + progressSuffix.replace(/^,\s*/, "") : ""}`; }
      else { const markersStr = markers.length ? markers.slice(0, sets.length).concat(Array(Math.max(0, sets.length - markers.length)).fill("[ ]")).join(" ") : Array(sets.length).fill("[ ]").join(" "); const tokens = sets.map((s) => isBodyweight ? (s.weight === 0 ? `${s.reps}xbw` : s.weight > 0 ? `${s.reps}xbw+${s.weight}${unit}` : `${s.reps}xbw${s.weight}${unit}`) : `${s.reps}x${s.weight}${unit}`).join(", "); const restPart = rest > 0 ? `, rest: ${rest}` : ""; const prog = progressSuffix ? (progressSuffix.startsWith(",") ? progressSuffix : ", " + progressSuffix.replace(/^,\s*/, "")) : ""; line = `${markersStr} ${n} / ${tokens}${restPart}${prog}`; }
      this.leaf.detach();
      await opts.onSave(line);
    };
    saveBtn.addEventListener("click", () => void handleSave());
    wrapper.addEventListener("keydown", (e) => { if ((e.ctrlKey || (e as any).metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void handleSave(); } if (e.key === "Escape") this.leaf.detach(); });
    window.setTimeout(() => nameInput.focus(), 50);
  }
}

/**
 * Open Kinetic edit — mobile stays Modal, desktop pops to its own window for sizing.
 * Wider (1024×800) as requested; resizable via OS window chrome.
 */
export function openKineticEdit(app: App, opts: KineticEditOptions): void {
  if (Platform.isMobile) {
    new KineticEditModal(app, opts).open();
    return;
  }
  try {
    const leaf = app.workspace.openPopoutLeaf({ size: { width: 1024, height: 780 } } as any);
    const pendingId = (leaf as any).id ?? Math.random().toString(36).slice(2);
    setPendingKinetic(pendingId, opts);
    // also store by leaf id for fallback
    setPendingKinetic((leaf as any).id ?? pendingId, opts);
    void leaf.setViewState({ type: KINETIC_VIEW_TYPE, state: { pendingId }, active: true });
  } catch (e) {
    // Fallback to modal if popouts unsupported (mobile/Electron old)
    console.warn("Kinetic popout unavailable, falling back to modal", e);
    new KineticEditModal(app, opts).open();
  }
}
