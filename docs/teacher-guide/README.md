# Teacher Presentation Package

This folder contains a ready-to-share teacher onboarding presentation for AerohawX.

## Deliverables

- `Teacher-Presentation.html`: slide-style source presentation.
- `Teacher-Presentation.pdf`: final shareable PDF export.
- `snips/*_annotated.png`: annotated walkthrough screenshots used in the slides.
- `snips/raw/*.png`: raw screenshots captured from the live teacher workflow.

## How to Regenerate

1. Ensure local app is running (`npm run dev`) on `http://127.0.0.1:3000`.
2. Ensure demo teacher user exists:
   - `node --env-file=.env.local scripts/ensure-teacher-demo.mjs`
3. Capture teacher screenshots:
   - `node --env-file=.env.local scripts/capture-teacher-guide.mjs`
4. Add callouts:
   - `python scripts/annotate-teacher-guide.py`
5. Export PDF:
   - Use headless Edge print-to-pdf for `docs/teacher-guide/Teacher-Presentation.html`.
