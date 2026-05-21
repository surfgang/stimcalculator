import {
  VYVANSE_DOSES_MG,
  calculateVyvanseTimeline,
} from "./vyvanse.js";
import {
  RITALIN_DOSES_MG,
  calculateRitalinTimeline,
} from "./ritalin.js";
import {
  RITALIN_XR_DOSES_MG,
  calculateRitalinXRTimeline,
} from "./ritalin-xr.js";
import {
  DEXTRO_DOSES_MG,
  calculateDextroamphetamineTimeline,
} from "./dextroamphetamine.js";

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
  "ritalin-xr": {
    id: "ritalin-xr",
    label: "Ritalin XR / LA (methylphenidate ER)",
    doses: RITALIN_XR_DOSES_MG,
    defaultDose: 20,
    calculate: calculateRitalinXRTimeline,
    disclaimer:
      "Estimates based on published pharmacokinetics (FDA label, Ritalin LA extended-release capsules, bimodal release). Individual response varies — not medical advice. Not for Concerta or other ER formulations.",
  },
  dextroamphetamine: {
    id: "dextroamphetamine",
    label: "Dextroamphetamine (Dexedrine IR)",
    doses: DEXTRO_DOSES_MG,
    defaultDose: 10,
    calculate: calculateDextroamphetamineTimeline,
    disclaimer:
      "Estimates based on published pharmacokinetics (FDA label, dextroamphetamine immediate-release tablets). Individual response varies — not medical advice. Not for Dexedrine Spansules / ER.",
  },
};

export const MED_IDS = Object.keys(MEDICATIONS);

/** @param {string} id */
export function getMedication(id) {
  return MEDICATIONS[id] ?? MEDICATIONS.vyvanse;
}
