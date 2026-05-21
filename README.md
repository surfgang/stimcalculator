# Stim Calculator

Estimate stimulant onset, peak, and wear-off times from your dose time and dosage (Vyvanse, Ritalin IR).

## Run locally

```bash
cd stimcalculator
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). ES modules require a local server (not `file://`).

## Adding medications later

Pharmacology lives in `meds/<med>.js`. Register new options in `meds/registry.js` and `index.html`.
