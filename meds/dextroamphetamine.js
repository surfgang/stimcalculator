/**
 * Dextroamphetamine (Dexedrine IR tablet) timing model.
 * References: FDA Dexedrine label — IR Cmax ~3h; onset ~20–60 min;
 * typical effect duration ~4–6h; elimination t½ ~12h (plasma).
 */

import { formatClock } from "./vyvanse.js";

/** Dexedrine IR tablet strengths and common titrated doses */
export const DEXTRO_DOSES_MG = [5, 10, 15, 20, 30, 40];

const REF_DOSE_MG = 10;

/** @param {number} doseMg */
export function doseScale(doseMg) {
  const delta = (doseMg - REF_DOSE_MG) / 10;
  const peakPlasmaH = 2.5 + Math.min(0.4, delta * 0.05);
  return {
    onsetMin: Math.max(18, 25 - delta * 2),
    onsetMax: Math.max(40, 55 - delta * 3),
    peakPlasmaH,
    peakEffectH: peakPlasmaH + 0.25 + Math.min(0.2, delta * 0.04),
    strongUntilH: 4 + delta * 0.3,
    wearOffStartH: 4.8 + delta * 0.35,
    totalDurationH: 6 + delta * 0.35,
    tailEndH: 8 + delta * 0.25,
  };
}

/**
 * @param {Date} doseTime
 * @param {number} doseMg
 */
export function calculateDextroamphetamineTimeline(doseTime, doseMg) {
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
      desc: `${doseMg} mg dextroamphetamine (IR)`,
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
      desc: "Highest blood levels (~Tmax ~2.5–3h for IR tablets)",
      time: peakPlasma,
      kind: "milestone",
    },
    {
      id: "peak-effect",
      label: "Peak effect",
      desc: "Strongest subjective effect, typically shortly after plasma peak",
      time: peakEffect,
      kind: "milestone",
    },
    {
      id: "active",
      label: "Active window",
      desc: "Typical ~4–6h duration of action (IR)",
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
      desc: `Trace effects possible (long plasma t½); subtle until ~${formatClock(tailEnd)}`,
      time: tailEnd,
      kind: "milestone",
      muted: true,
    },
  ];

  return {
    medId: "dextroamphetamine",
    medName: "Dextroamphetamine",
    doseMg,
    doseTime,
    scale: s,
    feltThreshold: 0.2,
    totalDurationH: s.totalDurationH,
    tailEndH: s.tailEndH,
    phases,
    barStart: doseTime,
    barEnd: tailEnd,
  };
}
