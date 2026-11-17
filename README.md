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

## Testing

### Local
1. Install deps: `npm install` (none required, zero runtime deps).
2. Smoke tests:
   ```
   npm test
   ```
   Expect `ALL TESTS PASSED`.
3. Dev server:
   ```
   npm start
   ```
   Then POST a sample:
   ```
   curl -X POST http://localhost:3000/api/score -H "Content-Type: application/json" -d '{"lead_id":"L001","channel":"whatsapp","conversation":[{"role":"lead","text":"Hi, looking for wholesale Monster Energy supply for Singapore. 1 FCL/month."},{"role":"agent","text":"Could you confirm your import license and history?"},{"role":"lead","text":"Yes, licensed 4 years. Currently import 2 brands."}]}'
   ```
4. Failure cases:
   - `curl -X POST ... -d '{bad json'` -> `400 {"error":"Invalid JSON body."}`
   - `curl -X POST ... -d '{"lead_id":"X"}'` -> `400` with `details`
   - `curl -X GET ...` -> `200 {"status":"ok",...}`

### Deployed (Vercel)
1. Deploy: `vercel --prod` (or import the GitHub repo in the Vercel dashboard).
2. Test the live endpoint:
   ```
   curl -X POST https://<your-deployment>.vercel.app/api/score -H "Content-Type: application/json" -d '{"lead_id":"S001","channel":"whatsapp","conversation":[{"role":"lead","text":"UAE distributor, 3 FCL/month Red Bull, 8 years importing energy drinks. Looking for original Austrian product."},{"role":"agent","text":"Volume target on Red Bull specifically?"},{"role":"lead","text":"2-3 FCL/month sustained. ~250 retail accounts across UAE."}]}'
   ```
3. Verify the three evaluation payloads:
   - S001 (Hot example) -> tier `Hot`, routing `kam_handoff`
   - S002 (Cold example) -> tier `Cold`, routing `auto_archive`
   - S003 (Ambiguous example) -> tier `Warm`, routing `nurture_pool`
4. Check response shape: `score` integer 0-100, `tier`, `routing`, `reasoning` (1-2 sentences). Response time < 30s.

## Failure handling
Invalid JSON / missing fields -> 400 JSON; non-POST -> 405; unhandled -> 500. CORS + OPTIONS supported.
