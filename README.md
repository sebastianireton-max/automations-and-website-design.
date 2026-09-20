# Automations & Website Design — 12 Builder Types Quiz Funnel

A Tai Lopez "12 Types"-style personality quiz funnel: 12 questions → 12 business-automation archetypes → email-gated results → lead capture.

## Structure
- `index.html` — self-contained quiz funnel (no build step, no framework)
- `api/leads.js` — Vercel serverless endpoint; validates, logs, and appends leads to Vercel Blob (`quiz-leads.json`) when `BLOB_READ_WRITE_TOKEN` is set
- `package.json` — one dependency: `@vercel/blob`

## Deploy to Vercel
1. Push this repo to GitHub (already: `sebastianireton-max/automations-and-website-design.` — yes, the repo name ends with a dot).
2. In Vercel: **Add New → Project → Import** the repo. Framework preset: **Other**. No build command needed.
3. Connect Vercel Blob storage: **Storage → Create → Blob** (gives you `BLOB_READ_WRITE_TOKEN` automatically).
4. Deploy. Leads land in your Blob store at `quiz-leads.json`; every lead is also in Function logs (`QUIZ_LEAD` line).

## Funnel flow
Landing (12-type grid) → 12 questions → email gate → result page (archetype + tailored next-step CTA) → "Book my free automation audit" mailto.

## Verify locally
Open `index.html` in a browser — the quiz works fully offline (the lead POST fails silently and results still show, by design: a broken endpoint never dead-ends the funnel).

## Customize
- Types/questions/results: the `ARCHETYPES` and `QUESTIONS` arrays in `index.html`.
- CTA: the `rCta` mailto link in `index.html`.
- Colors: the `:root` CSS variables.