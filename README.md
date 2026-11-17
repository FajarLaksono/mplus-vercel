# mplus-vercel — Lead Scoring Agent

Deployed HTTP endpoint that scores an inbound B2B beverage lead from a conversation transcript and returns a routing decision.

## Endpoint
`POST /api/score` with `{ lead_id, channel, conversation: [{role,text}] }`.
Returns `{ lead_id, score (0-100), tier (Hot|Warm|Cold), routing (kam_handoff|nurture_pool|auto_archive), reasoning }`.

## Model choice
No runtime LLM. Scoring is a deterministic, explainable heuristic (see `lib/scoring.js`) weighting: volume (0-25), import license (0-20), product fit (0-15), B2B business signals (0-35), engagement/specificity (0-15). Thresholds: <35 Cold, >=70 Hot, else Warm. Consumer-only requests ("few cans", "office party") are capped and auto-archived.

Rationale: zero external calls means <1s latency, no secrets to manage, and no LLM-failure path on the hot path — the brief's failure-handling bar is met by construction. With more time I'd add an LLM (GPT-4o-mini, JSON mode) for nuanced entity extraction behind the same scoring contract, with the heuristic as fallback, plus persistence, auth, and eval harnesses for prompt regression.

## Run locally
`npm test` (smoke tests) or `npm start` then POST to localhost:3000/api/score.

## Failure handling
Invalid JSON / missing fields -> 400 JSON; non-POST -> 405; unhandled -> 500. CORS + OPTIONS supported.
