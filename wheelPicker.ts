/** Wheel / drum picker bottom sheet for mobile — Teams-style duration picker.
 *  Used for Rest/Hold (minutes:seconds) and Weight (single wheel).
 *  Plain DOM, no Obsidian Modal, slides up as a bottom sheet. */

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

const ITEM_H = 48;
const VISIBLE = 3;
const VIEWPORT_H = ITEM_H * VISIBLE;

interface WheelColumn {
  viewport: HTMLDivElement;
  getValue(): number;
  setValue(v: number): void;
}

function createWheelColumn(
  values: number[],
  initial: number,
  label: string,
  unit?: string
): WheelColumn & { el: HTMLDivElement } {
  const col = document.createElement("div");
  col.className = "liftoscript-wheel-col";

  const labelEl = document.createElement("div");
  labelEl.className = "liftoscript-wheel-label";
  labelEl.textContent = label;
  col.appendChild(labelEl);

  const viewport = document.createElement("div");
  viewport.className = "liftoscript-wheel-viewport";
  viewport.style.height = VIEWPORT_H + "px";

  const track = document.createElement("div");
  track.className = "liftoscript-wheel-track";

  // spacers to allow first/last to center
  const topSpacer = document.createElement("div");
  topSpacer.className = "liftoscript-wheel-spacer";
  topSpacer.style.height = ITEM_H + "px";
  track.appendChild(topSpacer);

  const items: HTMLDivElement[] = [];
  values.forEach((v) => {
    const item = document.createElement("div");
    item.className = "liftoscript-wheel-item";
    item.style.height = ITEM_H + "px";
    item.textContent = unit ? `${v}${unit}` : String(v);
    item.dataset.value = String(v);
    track.appendChild(item);
    items.push(item);
  });

  const botSpacer = document.createElement("div");
  botSpacer.className = "liftoscript-wheel-spacer";
  botSpacer.style.height = ITEM_H + "px";
  track.appendChild(botSpacer);

  viewport.appendChild(track);
  col.appendChild(viewport);

  let selected = values.indexOf(initial);
  if (selected < 0) selected = 0;

  function updateSelected(idx: number) {
    selected = clamp(idx, 0, values.length - 1);
    items.forEach((el, i) => el.toggleClass("is-selected", i === selected));
  }

  // scroll handler
  let scrollTimer: number | null = null;
  viewport.addEventListener("scroll", () => {
    if (scrollTimer) window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      const idx = Math.round(viewport.scrollTop / ITEM_H);
      updateSelected(idx);
      // snap to exact
      viewport.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
    }, 80);
  });

  // tap to select
  items.forEach((el, i) => {
    el.addEventListener("click", () => {
      viewport.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
      updateSelected(i);
    });
  });

  // initial
  // Defer scroll to next frame so DOM is laid out
  requestAnimationFrame(() => {
    viewport.scrollTop = selected * ITEM_H;
    updateSelected(selected);
  });

  viewport.addEventListener("touchend", () => {
    // also snap on touch end
    window.setTimeout(() => {
      const idx = Math.round(viewport.scrollTop / ITEM_H);
      viewport.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
      updateSelected(idx);
    }, 100);
  });

  return {
    el: col,
    viewport,
    getValue: () => values[selected] ?? values[0],
    setValue: (v: number) => {
      const idx = values.indexOf(v);
      if (idx >= 0) {
        viewport.scrollTop = idx * ITEM_H;
        updateSelected(idx);
      }
    },
  };
}

function createSheet(title: string, onClose: () => void): {
  overlay: HTMLDivElement;
  sheet: HTMLDivElement;
  body: HTMLDivElement;
  close: () => void;
} {
  const overlay = document.createElement("div");
  overlay.className = "liftoscript-wheel-overlay";

  const sheet = document.createElement("div");
  sheet.className = "liftoscript-wheel-sheet";

  const header = document.createElement("div");
  header.className = "liftoscript-wheel-header";
  const titleEl = document.createElement("div");
  titleEl.className = "liftoscript-wheel-title";
  titleEl.textContent = title;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "liftoscript-wheel-close";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "Close");
  header.append(titleEl, closeBtn);

  const body = document.createElement("div");
  body.className = "liftoscript-wheel-body";

  const actions = document.createElement("div");
  actions.className = "liftoscript-wheel-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "liftoscript-wheel-btn";
  cancelBtn.textContent = "Cancel";
  const doneBtn = document.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "liftoscript-wheel-btn mod-cta";
  doneBtn.textContent = "Done";
  actions.append(cancelBtn, doneBtn);

  sheet.append(header, body, actions);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  // animate in
  requestAnimationFrame(() => overlay.addClass("is-open"));

  const close = () => {
    overlay.removeClass("is-open");
    window.setTimeout(() => overlay.remove(), 200);
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener("click", close);
  cancelBtn.addEventListener("click", close);
  onClose = close; // keep for done
  // expose done handler via closure
  (sheet as unknown as Record<string, unknown>)._close = close;
  (sheet as unknown as Record<string, unknown>)._doneBtn = doneBtn;
  (sheet as unknown as Record<string, unknown>)._cancelBtn = cancelBtn;

  return { overlay, sheet, body, close };
}

export function showDurationPicker(opts: {
  title: string;
  initialSeconds: number;
  min: number;
  max: number;
  step: number;
  onConfirm: (seconds: number) => void;
}): void {
  const { title, initialSeconds, min, max, onConfirm } = opts;
  const init = clamp(initialSeconds, min, max);
  const initMin = Math.floor(init / 60);
  const initSec = init % 60;

  // Build value sets
  const maxMin = Math.floor(max / 60);
  const minuteValues = Array.from({ length: maxMin + 1 }, (_, i) => i);
  // For seconds, honor step but ensure 0–59 coverage in 5s or 15s increments.
  // Use step as provided: e.g., 5 for Hold, 15 for Rest
  const secStep = opts.step === 15 ? 15 : 5;
  const secondValues: number[] = [];
  for (let s = 0; s < 60; s += secStep) secondValues.push(s);
  // Ensure initSec snaps to nearest available
  const snappedSec = secondValues.reduce((a, b) =>
    Math.abs(b - initSec) < Math.abs(a - initSec) ? b : a
  , secondValues[0]);

  const { overlay, body, close } = createSheet(title, () => {});
  body.addClass("liftoscript-wheel-body-duration");

  const minCol = createWheelColumn(minuteValues, initMin, "Min");
  const secCol = createWheelColumn(secondValues, snappedSec, "Sec");

  const wheels = document.createElement("div");
  wheels.className = "liftoscript-wheel-wheels";
  wheels.append(minCol.el, secCol.el);
  body.appendChild(wheels);

  const doneBtn = (overlay.querySelector(".liftoscript-wheel-btn.mod-cta") as HTMLButtonElement);
  doneBtn.addEventListener("click", () => {
    const m = minCol.getValue();
    const s = secCol.getValue();
    let total = m * 60 + s;
    total = clamp(total, min, max);
    // Snap total to step
    const remainder = total % opts.step;
    if (remainder !== 0) total = total - remainder + (remainder >= opts.step / 2 ? opts.step : 0);
    total = clamp(total, min, max);
    close();
    onConfirm(total);
  });
}

export function showWeightPicker(opts: {
  title: string;
  initial: number;
  min: number;
  max: number;
  step: number;
  onConfirm: (weight: number) => void;
}): void {
  const { title, initial, min, max, step, onConfirm } = opts;
  const init = clamp(initial, min, max);
  const values: number[] = [];
  for (let v = min; v <= max; v += step) values.push(Math.round(v * 100) / 100);
  // Ensure initial is in list
  if (!values.includes(init)) {
    // snap to nearest
    const nearest = values.reduce((a, b) => Math.abs(b - init) < Math.abs(a - init) ? b : a, values[0]);
    // use nearest for initial display
    (opts as Record<string, unknown>).initial = nearest;
  }

  const { overlay, body, close } = createSheet(title, () => {});
  const col = createWheelColumn(values, init, "Weight");
  const wheels = document.createElement("div");
  wheels.className = "liftoscript-wheel-wheels";
  wheels.style.justifyContent = "center";
  wheels.appendChild(col.el);
  body.appendChild(wheels);

  const doneBtn = (overlay.querySelector(".liftoscript-wheel-btn.mod-cta") as HTMLButtonElement);
  doneBtn.addEventListener("click", () => {
    const v = col.getValue();
    close();
    onConfirm(v);
  });
}
