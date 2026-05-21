import { renderTimelineChart } from "./chart.js";
import { getMedication, MEDICATIONS } from "./meds/registry.js";
import {
  formatClock,
  formatClockRange,
  formatDuration,
} from "./meds/vyvanse.js";

const ITEM_H = 44;
/** AM = 0, PM = 1 — only two scroll positions */
const TOGGLE_MAX_SCROLL = ITEM_H;
/** Odd repeat count — start in the middle cycle for “infinite” scroll */
const LOOP_REPEATS = 41;
const LOOP_MIDDLE = Math.floor(LOOP_REPEATS / 2);
const LOOP_RECENTER_MARGIN = 4;

const hourList = document.getElementById("hour-list");
const minuteList = document.getElementById("minute-list");
const ampmList = document.getElementById("ampm-list");
const doseGrid = document.getElementById("dose-grid");
const results = document.getElementById("results");
const resultsMeta = document.getElementById("results-meta");
const durationBanner = document.getElementById("duration-banner");
const timelineChart = document.getElementById("timeline-chart");
const phaseList = document.getElementById("phase-list");
const setNowBtn = document.getElementById("set-now-btn");
const medSelect = document.getElementById("med-select");
const disclaimerEl = document.getElementById("disclaimer");

let selectedMedId = "vyvanse";
let selectedDoseMg = MEDICATIONS.vyvanse.defaultDose;
/** @type {Array<() => void>} */
const pickerCancelFns = [];

/** AM/PM only — two items, no empty padding rows */
function buildTogglePicker(listEl, values) {
  listEl.innerHTML = values
    .map(
      (v, i) =>
        `<li class="picker-item" data-value-index="${i}">${v}</li>`
    )
    .join("");
  listEl.dataset.toggle = "true";
  listEl.classList.add("picker-list--toggle");
}

function isToggleList(listEl) {
  return listEl.dataset.toggle === "true";
}

function clampToggleScroll(listEl) {
  if (listEl.scrollTop < 0) listEl.scrollTop = 0;
  else if (listEl.scrollTop > TOGGLE_MAX_SCROLL) listEl.scrollTop = TOGGLE_MAX_SCROLL;
}

function getToggleIndex(listEl) {
  return Math.round(listEl.scrollTop / ITEM_H) >= 1 ? 1 : 0;
}

function clampToggleTarget(scrollTop) {
  return Math.max(0, Math.min(TOGGLE_MAX_SCROLL, scrollTop));
}

/** Repeat values many times; recenter scroll in the middle band while scrolling */
function buildLoopingPicker(listEl, values, formatter = (v) => v) {
  const len = values.length;
  const rows = [];
  for (let cycle = 0; cycle < LOOP_REPEATS; cycle++) {
    for (let i = 0; i < len; i++) {
      rows.push(
        `<li class="picker-item" data-value-index="${i}">${formatter(values[i])}</li>`
      );
    }
  }
  listEl.innerHTML = rows.join("");
  listEl.dataset.cycleLength = String(len);
  listEl.dataset.looping = "true";
}

function isLoopingList(listEl) {
  return listEl.dataset.looping === "true";
}

function getCycleLength(listEl) {
  return Number(listEl.dataset.cycleLength);
}

function getValueIndex(listEl) {
  const len = getCycleLength(listEl);
  const idx = getSelectedIndex(listEl);
  return ((idx % len) + len) % len;
}

function scrollLoopingToValue(listEl, valueIndex, cycle = LOOP_MIDDLE) {
  const len = getCycleLength(listEl);
  listEl.scrollTop = (cycle * len + valueIndex) * ITEM_H;
}

function maintainLoop(listEl) {
  if (!isLoopingList(listEl)) return;
  const len = getCycleLength(listEl);
  const idx = getSelectedIndex(listEl);
  const cycle = Math.floor(idx / len);
  if (
    cycle >= LOOP_RECENTER_MARGIN &&
    cycle < LOOP_REPEATS - LOOP_RECENTER_MARGIN
  ) {
    return;
  }
  const valueIndex = getValueIndex(listEl);
  const subOffset = listEl.scrollTop - idx * ITEM_H;
  const newIdx = LOOP_MIDDLE * len + valueIndex;
  listEl.scrollTop = newIdx * ITEM_H + subOffset;
}

function onPickerScroll(list, col, looping) {
  if (looping) maintainLoop(list);
  highlightPickerCol(col);
  updateResults();
}

/** True for discrete mouse wheel — trackpad uses native scroll + snap */
function isMouseWheelEvent(e) {
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) return true;
  if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) return true;
  return (
    e.deltaMode === WheelEvent.DOM_DELTA_PIXEL && Math.abs(e.deltaY) >= 100
  );
}

function scrollPickerTo(list, index, smooth) {
  const top = index * ITEM_H;
  if (smooth) {
    list.scrollTo({ top, behavior: "smooth" });
  } else {
    list.scrollTop = top;
  }
}

/** One row per mouse-wheel tick with smooth step; trackpad unchanged */
function onPickerWheel(e, list) {
  if (!isMouseWheelEvent(e)) return;
  e.preventDefault();
  const idx = getSelectedIndex(list);
  const next = idx + (Math.sign(e.deltaY) || 1);
  scrollPickerTo(list, next, true);
}

function onToggleWheel(e, list, col) {
  e.preventDefault();
  const idx = getToggleIndex(list);
  const next = e.deltaY > 0 ? 1 : 0;
  if (next !== idx) scrollPickerTo(list, next, true);
  highlightPickerCol(col);
  updateResults();
}

function onToggleScroll(list, col) {
  clampToggleScroll(list);
  highlightPickerCol(col);
  updateResults();
}

const DRAG_FOLLOW = 0.42;
const COAST_FRICTION = 0.93;
const COAST_MIN_VELOCITY = 0.35;
const COAST_MAX_VELOCITY = 28;

function bindPickerCol(col) {
  const list = col.querySelector(".picker-list");
  const looping = isLoopingList(list);
  const toggle = isToggleList(list);
  /** @type {{ mode: string, rafId?: number, target: number, velocity: number, pointerId?: number, lastY?: number, lastT?: number, startY?: number, startScroll?: number } | null} */
  let session = null;
  let scrollSyncQueued = false;

  function syncFromScroll() {
    if (toggle) onToggleScroll(list, col);
    else onPickerScroll(list, col, looping);
  }

  function queueScrollSync() {
    if (scrollSyncQueued) return;
    scrollSyncQueued = true;
    requestAnimationFrame(() => {
      scrollSyncQueued = false;
      syncFromScroll();
    });
  }

  function cancelSession() {
    if (session?.rafId) cancelAnimationFrame(session.rafId);
    session = null;
    list.classList.remove("picker-list--dragging");
  }

  pickerCancelFns.push(cancelSession);

  function tick() {
    if (!session) return;

    let continueFrame = false;

    if (session.mode === "drag") {
      const diff = session.target - list.scrollTop;
      if (Math.abs(diff) > 0.25) {
        list.scrollTop += diff * DRAG_FOLLOW;
        continueFrame = true;
      } else {
        list.scrollTop = session.target;
      }
    } else if (session.mode === "coast" && !toggle) {
      list.scrollTop += session.velocity;
      session.velocity *= COAST_FRICTION;
      if (Math.abs(session.velocity) >= COAST_MIN_VELOCITY) {
        continueFrame = true;
      } else {
        session.mode = "snap";
      }
    }

    if (toggle) clampToggleScroll(list);
    else if (looping) maintainLoop(list);
    highlightPickerCol(col);
    queueScrollSync();

    if (session.mode === "snap") {
      cancelSession();
      list.classList.remove("picker-list--dragging");
      snapPicker(col);
      onPickerScroll(list, col, looping);
      return;
    }

    session.rafId = continueFrame ? requestAnimationFrame(tick) : undefined;
  }

  function ensureTick() {
    if (!session || session.rafId) return;
    session.rafId = requestAnimationFrame(tick);
  }

  list.addEventListener(
    "scroll",
    () => {
      if (session?.mode === "drag" || session?.mode === "coast") return;
      syncFromScroll();
    },
    { passive: true }
  );
  list.addEventListener("scrollend", () => {
    if (session) return;
    snapPicker(col);
    syncFromScroll();
  });
  list.addEventListener(
    "wheel",
    (e) => (toggle ? onToggleWheel(e, list, col) : onPickerWheel(e, list)),
    { passive: false }
  );

  list.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    cancelSession();
    session = {
      mode: "drag",
      pointerId: e.pointerId,
      startY: e.clientY,
      startScroll: list.scrollTop,
      lastY: e.clientY,
      lastT: performance.now(),
      target: list.scrollTop,
      velocity: 0,
    };
    list.setPointerCapture(e.pointerId);
    list.classList.add("picker-list--dragging");
    ensureTick();
  });

  list.addEventListener("pointermove", (e) => {
    if (!session || session.mode !== "drag" || e.pointerId !== session.pointerId) {
      return;
    }
    const now = performance.now();
    const dt = Math.min(now - (session.lastT ?? now), 48);
    if (dt > 0) {
      const vy = ((session.lastY ?? e.clientY) - e.clientY) / dt;
      session.velocity = session.velocity * 0.5 + vy * 0.5;
    }
    session.lastY = e.clientY;
    session.lastT = now;
    const rawTarget = session.startScroll - (e.clientY - session.startY);
    session.target = toggle ? clampToggleTarget(rawTarget) : rawTarget;
    ensureTick();
  });

  const endDrag = (e) => {
    if (!session || e.pointerId !== session.pointerId) return;
    list.releasePointerCapture(e.pointerId);

    if (toggle) {
      session.mode = "snap";
      if (session.rafId) cancelAnimationFrame(session.rafId);
      session.rafId = undefined;
      tick();
      return;
    }

    const flick = Math.max(
      -COAST_MAX_VELOCITY,
      Math.min(COAST_MAX_VELOCITY, session.velocity * 14)
    );

    if (Math.abs(flick) > COAST_MIN_VELOCITY * 2) {
      session.mode = "coast";
      session.velocity = flick;
      if (session.rafId) cancelAnimationFrame(session.rafId);
      session.rafId = undefined;
      ensureTick();
    } else {
      session.mode = "snap";
      if (session.rafId) cancelAnimationFrame(session.rafId);
      session.rafId = undefined;
      tick();
    }
  };

  list.addEventListener("pointerup", endDrag);
  list.addEventListener("pointercancel", endDrag);
}

function initPicker() {
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, "0")
  );
  buildLoopingPicker(hourList, hours);
  buildLoopingPicker(minuteList, minutes);
  buildTogglePicker(ampmList, ["AM", "PM"]);

  setPickerToNow(true);

  document.querySelectorAll(".picker-col").forEach(bindPickerCol);
  document.querySelectorAll(".picker-col").forEach(highlightPickerCol);
}

function scrollToIndex(listEl, index) {
  listEl.scrollTop = index * ITEM_H;
}

function getSelectedIndex(listEl) {
  return Math.round(listEl.scrollTop / ITEM_H);
}

function snapPicker(col, smooth = true) {
  const list = col.querySelector(".picker-list");
  const useSmooth = smooth && !list.classList.contains("picker-list--dragging");

  if (isToggleList(list)) {
    const idx = getToggleIndex(list);
    const top = idx * ITEM_H;
    if (Math.abs(list.scrollTop - top) < 1) return;
    scrollPickerTo(list, idx, useSmooth);
    return;
  }

  const idx = getSelectedIndex(list);
  const top = idx * ITEM_H;
  if (Math.abs(list.scrollTop - top) < 1) return;
  scrollPickerTo(list, idx, useSmooth);
}

function highlightPickerCol(col) {
  const list = col.querySelector(".picker-list");
  const idx = getSelectedIndex(list);
  list.querySelectorAll(".picker-item").forEach((item, i) => {
    item.classList.toggle("picker-item--selected", i === idx);
  });
}

/** @param {boolean} [instant] Skip scroll animation (page load only) */
function setPickerToNow(instant = false) {
  const now = new Date();
  let h = now.getHours();
  const ampm = h >= 12 ? 1 : 0;
  h = h % 12 || 12;

  const lists = [hourList, minuteList, ampmList];
  if (instant) {
    lists.forEach((list) => {
      list.style.scrollBehavior = "auto";
    });
  }

  scrollLoopingToValue(hourList, h - 1);
  scrollLoopingToValue(minuteList, now.getMinutes());
  scrollPickerTo(ampmList, ampm, false);

  if (instant) {
    requestAnimationFrame(() => {
      lists.forEach((list) => {
        list.style.scrollBehavior = "";
      });
    });
  }
}

function resetPickerToNow() {
  pickerCancelFns.forEach((cancel) => cancel());
  setPickerToNow(true);
  document.querySelectorAll(".picker-col").forEach(highlightPickerCol);
  updateResults();
}

function readPickerTime() {
  const hourIdx = getValueIndex(hourList);
  const minIdx = getValueIndex(minuteList);
  const ampmIdx = getToggleIndex(ampmList);

  let hour = hourIdx + 1;
  const minute = minIdx;
  const isPm = ampmIdx === 1;

  if (hour === 12) hour = isPm ? 12 : 0;
  else if (isPm) hour += 12;

  const now = new Date();
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0,
    0
  );
  return d;
}

function getSelectedMed() {
  return getMedication(selectedMedId);
}

function pickDoseForMed(med) {
  if (med.doses.includes(selectedDoseMg)) return selectedDoseMg;
  const closest = med.doses.reduce((a, b) =>
    Math.abs(b - selectedDoseMg) < Math.abs(a - selectedDoseMg) ? b : a
  );
  return closest;
}

function renderDoseGrid() {
  const med = getSelectedMed();
  selectedDoseMg = pickDoseForMed(med);
  doseGrid.setAttribute("aria-label", `${med.label} dosage`);
  doseGrid.innerHTML = "";

  med.doses.forEach((mg) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dose-btn";
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", mg === selectedDoseMg ? "true" : "false");
    btn.dataset.mg = String(mg);
    btn.innerHTML = `<span class="dose-num">${mg}</span><span class="dose-unit">mg</span>`;
    if (mg === selectedDoseMg) btn.classList.add("dose-btn--active");
    btn.addEventListener("click", () => {
      selectedDoseMg = mg;
      doseGrid.querySelectorAll(".dose-btn").forEach((b) => {
        const active = Number(b.dataset.mg) === mg;
        b.classList.toggle("dose-btn--active", active);
        b.setAttribute("aria-checked", active ? "true" : "false");
      });
      updateResults();
    });
    doseGrid.appendChild(btn);
  });
}

function onMedChange() {
  selectedMedId = medSelect.value;
  renderDoseGrid();
  updateResults();
}

const PHASE_COLORS = {
  dose: "#6b8cff",
  onset: "#7eb8da",
  rising: "#5ec9b0",
  "peak-plasma": "#f0b429",
  "peak-effect": "#f08c42",
  active: "#e86a9a",
  declining: "#b07ad9",
  "wear-off": "#8b9cb3",
  end: "#6b7a8f",
  tail: "#4a5568",
};

function renderTimeline(timeline) {
  const { phases, totalDurationH } = timeline;

  renderTimelineChart(timelineChart, timeline, PHASE_COLORS);

  durationBanner.innerHTML = `
    <span class="duration-value">~${formatDuration(totalDurationH)}</span>
    <span class="duration-label">expected active period</span>
  `;

  resultsMeta.textContent = `${timeline.doseMg} mg ${timeline.medName} at ${formatClock(timeline.doseTime)}`;
  disclaimerEl.textContent = getSelectedMed().disclaimer;

  phaseList.innerHTML = phases
    .map((p) => {
      const timeStr =
        p.kind === "range"
          ? formatClockRange(p.timeStart, p.timeEnd)
          : formatClock(p.time);
      const muted = p.muted ? " phase-item--muted" : "";
      return `
        <li class="phase-item${muted}">
          <span class="phase-dot" style="background:${PHASE_COLORS[p.id]}"></span>
          <div class="phase-body">
            <span class="phase-time">${timeStr}</span>
            <span class="phase-label">${p.label}</span>
            <span class="phase-desc">${p.desc}</span>
          </div>
        </li>`;
    })
    .join("");
}

function updateResults() {
  const doseTime = readPickerTime();
  const med = getSelectedMed();
  const timeline = med.calculate(doseTime, selectedDoseMg);
  results.classList.remove("hidden");
  renderTimeline(timeline);
}

initPicker();
renderDoseGrid();
medSelect.addEventListener("change", onMedChange);
setNowBtn.addEventListener("click", resetPickerToNow);
disclaimerEl.textContent = getSelectedMed().disclaimer;
updateResults();
