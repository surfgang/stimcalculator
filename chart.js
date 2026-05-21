import { formatClock } from "./meds/vyvanse.js";

const W = 400;
const H = 200;
const M = { top: 18, right: 14, bottom: 38, left: 44 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

const DEFAULT_FELT_THRESHOLD = 0.18;

/** Piecewise effect curve (0–1) from hours since dose */
function effectAt(h, s) {
  const knots = [
    [0, 0],
    [s.onsetMin / 60, 0.06],
    [s.onsetMax / 60, 0.2],
    [s.peakPlasmaH, 0.92],
    [s.peakEffectH, 1],
    [s.strongUntilH, 0.86],
    [s.wearOffStartH, 0.48],
    [s.totalDurationH, 0.08],
    [s.tailEndH, 0.02],
  ];
  if (h <= 0) return 0;
  if (h >= knots[knots.length - 1][0]) return knots[knots.length - 1][1];
  for (let i = 0; i < knots.length - 1; i++) {
    const [x0, y0] = knots[i];
    const [x1, y1] = knots[i + 1];
    if (h >= x0 && h <= x1) {
      const t = (h - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return 0;
}

function sampleCurve(timeline, stepMin = 12) {
  const t0 = timeline.doseTime.getTime();
  const endH =
    (timeline.barEnd.getTime() - t0) / 3_600_000;
  const s = timeline.scale;
  const points = [];
  for (let h = 0; h <= endH; h += stepMin / 60) {
    points.push({ h, level: effectAt(h, s), time: new Date(t0 + h * 3_600_000) });
  }
  return points;
}

function xPos(h, endH) {
  return M.left + (h / endH) * PW;
}

function yPos(level) {
  return M.top + PH - level * PH;
}

function linePath(points, endH) {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xPos(p.h, endH).toFixed(1)},${yPos(p.level).toFixed(1)}`)
    .join(" ");
}

function areaPath(points, endH) {
  const line = linePath(points, endH);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L${xPos(last.h, endH).toFixed(1)},${yPos(0).toFixed(1)} L${xPos(first.h, endH).toFixed(1)},${yPos(0).toFixed(1)} Z`;
}

function hoursSince(doseTime, date) {
  return (date.getTime() - doseTime.getTime()) / 3_600_000;
}

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

/**
 * @param {HTMLElement} container
 * @param {ReturnType<import('./meds/vyvanse.js').calculateVyvanseTimeline>} timeline
 * @param {Record<string, string>} phaseColors
 */
export function renderTimelineChart(container, timeline, phaseColors) {
  const { doseTime, phases, barEnd } = timeline;
  const endH = hoursSince(doseTime, barEnd);
  const points = sampleCurve(timeline);

  const yTicks = [0, 0.5, 1];
  const xTickStep = endH <= 10 ? 2 : endH <= 14 ? 3 : 4;
  const xTicks = [];
  for (let h = 0; h <= endH; h += xTickStep) xTicks.push(h);

  const rangePhases = phases.filter((p) => p.kind === "range");
  const milestones = phases.filter(
    (p) => p.kind === "milestone" && !p.muted && p.id !== "dose"
  );

  const bands = rangePhases
    .map((p) => {
      const h0 = hoursSince(doseTime, p.timeStart);
      const h1 = hoursSince(doseTime, p.timeEnd);
      const x = xPos(h0, endH);
      const w = Math.max(1, xPos(h1, endH) - x);
      const color = phaseColors[p.id] ?? "#888";
      return `<rect class="chart-band" x="${x.toFixed(1)}" y="${M.top}" width="${w.toFixed(1)}" height="${PH}" fill="${color}" opacity="0.12"/>`;
    })
    .join("");

  const gridH = yTicks
    .map((lvl) => {
      const y = yPos(lvl).toFixed(1);
      return `<line class="chart-grid" x1="${M.left}" y1="${y}" x2="${W - M.right}" y2="${y}"/>`;
    })
    .join("");

  const gridV = xTicks
    .map((h) => {
      const x = xPos(h, endH).toFixed(1);
      return `<line class="chart-grid chart-grid--v" x1="${x}" y1="${M.top}" x2="${x}" y2="${M.top + PH}"/>`;
    })
    .join("");

  const yLabels = yTicks
    .map((lvl) => {
      const y = yPos(lvl);
      const label = lvl === 0 ? "Low" : lvl === 1 ? "Peak" : "Mid";
      return `<text class="chart-axis-y" x="${M.left - 8}" y="${y + 4}" text-anchor="end">${label}</text>`;
    })
    .join("");

  const xLabels = xTicks
    .map((h) => {
      const t = new Date(doseTime.getTime() + h * 3_600_000);
      const x = xPos(h, endH);
      return `<text class="chart-axis-x" x="${x.toFixed(1)}" y="${H - 10}" text-anchor="middle">${escapeXml(formatClock(t))}</text>`;
    })
    .join("");

  const markers = milestones
    .map((p) => {
      const h = hoursSince(doseTime, p.time);
      const x = xPos(h, endH);
      const y = yPos(effectAt(h, timeline.scale));
      const color = phaseColors[p.id] ?? "#fff";
      return `<g class="chart-marker">
        <line class="chart-marker-line" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${M.top + PH}"/>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${color}" stroke="var(--bg)" stroke-width="2"/>
        <title>${escapeXml(p.label)} · ${escapeXml(formatClock(p.time))}</title>
      </g>`;
    })
    .join("");

  const doseX = M.left;
  const doseMarker = `<circle class="chart-dose-dot" cx="${doseX}" cy="${yPos(0).toFixed(1)}" r="5" fill="${phaseColors.dose}"/>`;

  const now = new Date();
  const nowH = hoursSince(doseTime, now);
  const showNow = nowH >= 0 && nowH <= endH;
  const nowLine = showNow
    ? (() => {
        const x = xPos(nowH, endH);
        const yTop = M.top - 2;
        return `<g class="chart-now">
          <line class="chart-now-line" x1="${x.toFixed(1)}" y1="${yTop}" x2="${x.toFixed(1)}" y2="${M.top + PH}"/>
          <text class="chart-now-label" x="${x.toFixed(1)}" y="${yTop + 10}" text-anchor="middle">Now</text>
          <title>Current time · ${escapeXml(formatClock(now))}</title>
        </g>`;
      })()
    : "";

  const feltThreshold = timeline.feltThreshold ?? DEFAULT_FELT_THRESHOLD;
  const feltY = yPos(feltThreshold);
  const feltLine = `<g class="chart-felt">
    <line class="chart-felt-line" x1="${M.left}" y1="${feltY.toFixed(1)}" x2="${W - M.right}" y2="${feltY.toFixed(1)}"/>
    <text class="chart-felt-label" x="${W - M.right - 2}" y="${feltY - 4}" text-anchor="end">Usually felt</text>
    <title>~${Math.round(feltThreshold * 100)}% of peak — typical threshold for noticeable effect</title>
  </g>`;

  const legendExtras = [
    ...(showNow
      ? [`<span class="chart-legend-item chart-legend-item--now"><span class="chart-legend-line chart-legend-line--now"></span>Now</span>`]
      : []),
    `<span class="chart-legend-item"><span class="chart-legend-line chart-legend-line--felt"></span>Usually felt</span>`,
  ].join("");

  const legend = rangePhases
    .slice(0, 5)
    .map((p) => {
      const c = phaseColors[p.id] ?? "#888";
      return `<span class="chart-legend-item"><span class="chart-legend-swatch" style="background:${c}"></span>${escapeXml(p.label)}</span>`;
    })
    .join("");

  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Estimated effect level from dose time through wear-off">
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02"/>
        </linearGradient>
        <linearGradient id="chart-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#7eb8da"/>
          <stop offset="35%" stop-color="#f0b429"/>
          <stop offset="55%" stop-color="#e86a9a"/>
          <stop offset="100%" stop-color="#6b7a8f"/>
        </linearGradient>
      </defs>
      ${bands}
      ${gridH}
      ${gridV}
      ${feltLine}
      <path class="chart-area" d="${areaPath(points, endH)}"/>
      <path class="chart-line" d="${linePath(points, endH)}"/>
      ${doseMarker}
      ${markers}
      ${nowLine}
      ${yLabels}
      ${xLabels}
    </svg>
    <div class="chart-legend">${legend}${legendExtras}</div>
  `;
}
