import {
  VYVANSE_DOSES_MG,
  calculateVyvanseTimeline,
} from "./vyvanse.js";
import {
  RITALIN_DOSES_MG,
  calculateRitalinTimeline,
} from "./ritalin.js";

/** @typedef {typeof calculateVyvanseTimeline} CalcTimeline */
/** @typedef {{ id: string, label: string, doses: number[], defaultDose: number, calculate: CalcTimeline, disclaimer: string }} MedConfig */

/** @type {Record<string, MedConfig>} */
export const MEDICATIONS = {
  vyvanse: {
    id: "vyvanse",
    label: "Vyvanse (lisdexamfetamine)",
    doses: VYVANSE_DOSES_MG,
    defaultDose: 30,
    calculate: calculateVyvanseTimeline,
    disclaimer:
      "Estimates based on published pharmacokinetics (FDA label, adult fasted Vyvanse capsules). Individual response varies — not medical advice.",
  },
  ritalin: {
    id: "ritalin",
    label: "Ritalin (methylphenidate IR)",
    doses: RITALIN_DOSES_MG,
    defaultDose: 20,
    calculate: calculateRitalinTimeline,
    disclaimer:
      "Estimates based on published pharmacokinetics (FDA label, Ritalin immediate-release tablets). Individual response varies — not medical advice. Not for Ritalin-SR / Concerta.",
  },
};

export const MED_IDS = Object.keys(MEDICATIONS);

/** @param {string} id */
export function getMedication(id) {
  return MEDICATIONS[id] ?? MEDICATIONS.vyvanse;
}
