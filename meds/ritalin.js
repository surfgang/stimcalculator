/**
 * Ritalin (methylphenidate) immediate-release tablet timing model.
 * References: FDA label — IR tablet Tmax ~1.9h (range 0.3–4.4h); clinical onset ~20–60 min;
 * typical effect duration ~3–6h; t½ ~2–3h in adults.
 */

import { formatClock } from "./vyvanse.js";

/** Common single-dose amounts (tablets: 5, 10, 20 mg; higher values = multi-tablet / titrated) */
export const RITALIN_DOSES_MG = [5, 10, 15, 20, 30, 40, 60];

const REF_DOSE_MG = 20;

/** @param {number} doseMg */
export function doseScale(doseMg) {
  const delta = (doseMg - REF_DOSE_MG) / 10;
  return {
    onsetMin: Math.max(15, 22 - delta * 2),
    onsetMax: Math.max(35, 50 - delta * 3),
    peakPlasmaH: 1.9,
    peakEffectH: 2 + Math.min(0.35, delta * 0.06),
    strongUntilH: 3.2 + delta * 0.28,
    wearOffStartH: 3.8 + delta * 0.32,
    totalDurationH: 5 + delta * 0.35,
    tailEndH: 6.5 + delta * 0.2,
  };
}

/**
 * @param {Date} doseTime
 * @param {number} doseMg
 */
export function calculateRitalinTimeline(doseTime, doseMg) {
  const s = doseScale(doseMg);

  const addMinutes = (mins) => new Date(doseTime.getTime() + mins * 60_000);
  const addHours = (h) => new Date(doseTime.getTime() + h * 3_600_000);

  const onsetStart = addMinutes(s.onsetMin);
  const onsetEnd = addMinutes(s.onsetMax);
  const peakPlasma = addHours(s.peakPlasmaH);
  const peakEffect = addHours(s.peakEffectH);
  const strongUntil = addHours(s.strongUntilH);
  const wearOffStart = addHours(s.wearOffStartH);
  const likelyEnd = addHours(s.totalDurationH);
  const tailEnd = addHours(s.tailEndH);

  const phases = [
    {
      id: "dose",
      label: "Dose taken",
      desc: `${doseMg} mg Ritalin (IR)`,
      time: doseTime,
      kind: "milestone",
    },
    {
      id: "onset",
      label: "Onset",
      desc: "Effects often noticeable within ~20–60 min",
      timeStart: onsetStart,
      timeEnd: onsetEnd,
      kind: "range",
    },
    {
      id: "rising",
      label: "Rising",
      desc: "Concentration and effect increasing",
      timeStart: onsetEnd,
      timeEnd: peakPlasma,
      kind: "range",
    },
    {
      id: "peak-plasma",
      label: "Peak plasma",
      desc: "Highest methylphenidate levels (~Tmax ~1.9h)",
      time: peakPlasma,
      kind: "milestone",
    },
    {
      id: "peak-effect",
      label: "Peak effect",
      desc: "Strongest effect for many people",
      time: peakEffect,
      kind: "milestone",
    },
    {
      id: "active",
      label: "Active window",
      desc: "Typical 3–6h duration of action (IR)",
      timeStart: peakEffect,
      timeEnd: strongUntil,
      kind: "range",
    },
    {
      id: "declining",
      label: "Declining",
      desc: "Effect tapering; may still feel stimulated",
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
      desc: "Most no longer feel medicated (±1h variation)",
      time: likelyEnd,
      kind: "milestone",
    },
    {
      id: "tail",
      label: "Residual tail",
      desc: `Subtle effects possible (t½ ~2–3h); faint until ~${formatClock(tailEnd)}`,
      time: tailEnd,
      kind: "milestone",
      muted: true,
    },
  ];

  return {
    medId: "ritalin",
    medName: "Ritalin",
    doseMg,
    doseTime,
    scale: s,
    feltThreshold: 0.22,
    totalDurationH: s.totalDurationH,
    tailEndH: s.tailEndH,
    phases,
    barStart: doseTime,
    barEnd: tailEnd,
  };
}
