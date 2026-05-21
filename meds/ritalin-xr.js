/**
 * Ritalin LA / XR (methylphenidate extended-release) timing model.
 * References: FDA Ritalin LA label — bimodal profile: Tmax1 ~1.8–2h, Tmax2 ~5.6–6.6h;
 * ~8h duration of action vs split IR doses; t½ ~2.5–3.5h (methylphenidate).
 */

import { formatClock } from "./vyvanse.js";

/** Ritalin LA capsule strengths (mg) */
export const RITALIN_XR_DOSES_MG = [10, 20, 30, 40, 60];

const REF_DOSE_MG = 20;

/** @param {number} doseMg */
export function doseScale(doseMg) {
  const delta = (doseMg - REF_DOSE_MG) / 10;
  return {
    onsetMin: Math.max(18, 22 - delta * 2),
    onsetMax: Math.max(38, 48 - delta * 2),
    peak1H: 1.9,
    interpeakH: 3.5 + delta * 0.1,
    peak2H: 5.8 + delta * 0.12,
    peakPlasmaH: 1.9,
    peakEffectH: 5.8 + delta * 0.12,
    strongUntilH: 7.5 + delta * 0.35,
    wearOffStartH: 8.5 + delta * 0.35,
    totalDurationH: 9.5 + delta * 0.4,
    tailEndH: 11 + delta * 0.25,
  };
}

function buildEffectKnots(s) {
  return [
    [0, 0],
    [s.onsetMin / 60, 0.07],
    [s.onsetMax / 60, 0.18],
    [s.peak1H, 0.82],
    [s.interpeakH, 0.52],
    [s.peak2H, 0.95],
    [s.strongUntilH, 0.78],
    [s.wearOffStartH, 0.45],
    [s.totalDurationH, 0.08],
    [s.tailEndH, 0.02],
  ];
}

/**
 * @param {Date} doseTime
 * @param {number} doseMg
 */
export function calculateRitalinXRTimeline(doseTime, doseMg) {
  const s = doseScale(doseMg);

  const addMinutes = (mins) => new Date(doseTime.getTime() + mins * 60_000);
  const addHours = (h) => new Date(doseTime.getTime() + h * 3_600_000);

  const onsetStart = addMinutes(s.onsetMin);
  const onsetEnd = addMinutes(s.onsetMax);
  const peak1 = addHours(s.peak1H);
  const interpeak = addHours(s.interpeakH);
  const peak2 = addHours(s.peak2H);
  const strongUntil = addHours(s.strongUntilH);
  const wearOffStart = addHours(s.wearOffStartH);
  const likelyEnd = addHours(s.totalDurationH);
  const tailEnd = addHours(s.tailEndH);

  const phases = [
    {
      id: "dose",
      label: "Dose taken",
      desc: `${doseMg} mg Ritalin LA / XR`,
      time: doseTime,
      kind: "milestone",
    },
    {
      id: "onset",
      label: "Onset",
      desc: "First IR bead fraction — effects often start ~20–50 min",
      timeStart: onsetStart,
      timeEnd: onsetEnd,
      kind: "range",
    },
    {
      id: "rising",
      label: "First rise",
      desc: "Approaching first plasma peak (immediate-release portion)",
      timeStart: onsetEnd,
      timeEnd: peak1,
      kind: "range",
    },
    {
      id: "peak-plasma",
      label: "First peak (Cmax1)",
      desc: "First peak ~1.8–2h (FDA Ritalin LA, similar to IR)",
      time: peak1,
      kind: "milestone",
    },
    {
      id: "interpeak",
      label: "Mid-day dip",
      desc: "Inter-peak minimum between bimodal releases",
      timeStart: peak1,
      timeEnd: interpeak,
      kind: "range",
    },
    {
      id: "second-peak",
      label: "Second peak (Cmax2)",
      desc: "Second peak ~5.6–6.6h (delayed-release portion)",
      time: peak2,
      kind: "milestone",
    },
    {
      id: "active",
      label: "Extended active",
      desc: "~8h duration of action vs twice-daily IR",
      timeStart: peak2,
      timeEnd: strongUntil,
      kind: "range",
    },
    {
      id: "declining",
      label: "Declining",
      desc: "Effect tapering through the afternoon/evening",
      timeStart: strongUntil,
      timeEnd: wearOffStart,
      kind: "range",
    },
    {
      id: "wear-off",
      label: "Wear-off",
      desc: "Noticeable drop as levels fall",
      timeStart: wearOffStart,
      timeEnd: likelyEnd,
      kind: "range",
    },
    {
      id: "end",
      label: "Likely clear",
      desc: "Most no longer feel medicated (±1–2h variation)",
      time: likelyEnd,
      kind: "milestone",
    },
    {
      id: "tail",
      label: "Residual tail",
      desc: `Subtle effects possible; faint until ~${formatClock(tailEnd)}`,
      time: tailEnd,
      kind: "milestone",
      muted: true,
    },
  ];

  return {
    medId: "ritalin-xr",
    medName: "Ritalin XR",
    doseMg,
    doseTime,
    scale: s,
    effectKnots: buildEffectKnots(s),
    feltThreshold: 0.2,
    totalDurationH: s.totalDurationH,
    tailEndH: s.tailEndH,
    phases,
    barStart: doseTime,
    barEnd: tailEnd,
  };
}
