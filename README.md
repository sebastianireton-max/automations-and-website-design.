# Automations & Website Design — 12 Builder Types Quiz Funnel

A Tai Lopez "12 Types"-style personality quiz funnel: 12 questions → 12 business-automation archetypes → email-gated results → full tracking → CRM-ready lead delivery.

## Structure
- `index.html` — self-contained quiz funnel (no build step, no framework). Quiz + client-side event tracking.
- `api/collect.js` — single Vercel serverless endpoint for ALL data: events + leads, server-side enrichment (IP/geo/UA), Blob storage, CRM webhook forward.
- `verify.mjs` — assert-based smoke check (`npm test`): quiz flow, event stream, lead payload, endpoint behavior.
- `package.json` — one dependency: `@vercel/blob`.

## Everything tracked (per session id, joinable on `sessionId`)
| Event | When | Data |
|---|---|---|
| `pageview` | page load | referrer, screen, UTM params, path |
| `quiz_start` | "Take the test" clicked | — |
| `question_answered` | each answer | question #, chosen archetype, ms spent |
| `quiz_completed` | last answer | full score map, top archetype, total ms |
| `quiz_dropoff` | tab hidden mid-quiz | question #, elapsed ms |
| `result_viewed` | result revealed | archetype |
| `lead` | email gate submitted | name, email, archetype, tagline, all 12 answers, full scores, total ms, UTM |
| *(server adds)* | every record | timestamp, IP, country/city (Vercel geo headers), device type, UA, referer |

## CRM / app connection — ONE env var
Set `CRM_WEBHOOK_URL` in Vercel (Settings → Environment Variables) to any webhook:
- **Zapier/Make**: catch-hook URL → map `data.email`, `data.name`, `data.archetypeName`, `data.scores` into any CRM (HubSpot, GHL, Pipedrive...)
- **HubSpot**: a Workflow webhook trigger or a private-app endpoint
- **GoHighLevel**: custom webhook on a contact/custom-values trigger

The POSTed JSON is the full lead record (all fields above incl. server enrichment). No `CRM_WEBHOOK_URL` set → lead is still stored + logged, funnel unaffected.

## Deploy to Vercel
1. Import this repo in Vercel (framework: **Other**, no build command).
2. **Storage → Create → Blob** (adds `BLOB_READ_WRITE_TOKEN`) → records land at `leads/*.json` and `events/*.json`.
3. Set `CRM_WEBHOOK_URL` (optional, from your CRM's webhook).
4. Every lead + event is also in Function logs (`QUIZ_LEAD` / `QUIZ_EVENT` lines) — nothing is lost even with zero config.

## Verify locally
`npm test` — 30 assertions: quiz data integrity, full 12-question flow, complete event stream, lead payload shape, collect.js (405/400/200/CRM-forward), package.json. `index.html` also runs fully offline in a browser (failed POSTs never dead-end the funnel).

## Customize
- Types/questions/results: `ARCHETYPES` / `QUESTIONS` arrays in `index.html`.
- CTA: the `rCta` mailto link in `index.html`.
- Colors: the `:root` CSS variables.