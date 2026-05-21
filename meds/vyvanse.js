/**
 * Vyvanse (lisdexamfetamine) timing model.
 * References: FDA prescribing info — d-amphetamine Tmax ~3.5h, t½ ~10–11.3h (adults);
 * clinical effect assessments to ~12–13h post-dose.
 */

export const VYVANSE_DOSES_MG = [10, 20, 30, 40, 50, 60, 70];

const REF_DOSE_MG = 30;

/** @param {number} doseMg */
export function doseScale(doseMg) {
  const delta = (doseMg - REF_DOSE_MG) / 10;
  return {
    onsetMin: Math.max(45, 60 - delta * 3),
    onsetMax: Math.max(60, 90 - delta * 4),
    peakPlasmaH: 3.5,
    peakEffectH: 3.5 + Math.min(0.5, delta * 0.08),
    strongUntilH: 8 + delta * 0.35,
    wearOffStartH: 9 + delta * 0.4,
    totalDurationH: 12 + delta * 0.35,
    tailEndH: 13.5 + delta * 0.25,
  };
}

/**
 * @param {Date} doseTime
 * @param {number} doseMg
 */
export function calculateVyvanseTimeline(doseTime, doseMg) {
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
      desc: `${doseMg} mg Vyvanse`,
      time: doseTime,
      kind: "milestone",
    },
    {
      id: "onset",
      label: "Onset",
      desc: "Effects usually becoming noticeable",
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
      desc: "Highest d-amphetamine blood levels (~Tmax)",
      time: peakPlasma,
      kind: "milestone",
    },
    {
      id: "peak-effect",
      label: "Peak effect",
      desc: "Strongest therapeutic effect for many people",
      time: peakEffect,
      kind: "milestone",
    },
    {
      id: "active",
      label: "Active window",
      desc: "Reliable focus / stimulation for most",
      timeStart: peakEffect,
      timeEnd: strongUntil,
      kind: "range",
    },
    {
      id: "declining",
      label: "Declining",
      desc: "Effect tapering; may still feel “on it”",
      timeStart: strongUntil,
      timeEnd: wearOffStart,
      kind: "range",
    },
    {
      id: "wear-off",
      label: "Wear-off",
      desc: "Noticeable drop; crash risk varies by person",
      timeStart: wearOffStart,
      timeEnd: likelyEnd,
      kind: "range",
    },
    {
      id: "end",
      label: "Likely clear",
      desc: "Most no longer feel medicated (±2h individual variation)",
      time: likelyEnd,
      kind: "milestone",
    },
    {
      id: "tail",
      label: "Residual tail",
      desc: `Trace effects possible (t½ ~10–11h); subtle until ~${formatClock(tailEnd)}`,
      time: tailEnd,
      kind: "milestone",
      muted: true,
    },
  ];

  return {
    doseMg,
    doseTime,
    scale: s,
    totalDurationH: s.totalDurationH,
    tailEndH: s.tailEndH,
    phases,
    barStart: doseTime,
    barEnd: tailEnd,
  };
}

/** @param {Date} d */
export function formatClock(d) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** @param {Date} d */
export function formatClockRange(a, b) {
  return `${formatClock(a)} – ${formatClock(b)}`;
}

/** @param {number} hours */
export function formatDuration(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}
