# ClearWeek verification

## Current verification summary (November 9, 2026)

Run with Node.js 26.8.2 on the working tree after the provenance, conflict and time-format changes. Earlier results are kept below as dated history and were not rewritten. Counts below are from runs on November 9 unless a row says otherwise.

| Check | Result | Scope |
| --- | --- | --- |
| `npm run lint`, `npm run typecheck` | Passed | Whole project. |
| `npm test` (Vitest) | 28 passed, 3 files | Calendar and approval logic (9, from before), offline conflict, edit and provenance rules, legacy-row loading, deterministic time format (`tests/approval.test.ts`), and the private server logic against an in-memory stand-in for the one table (`tests/private-server.test.ts`). Model calls are mocked; none were made. |
| `npm run test:e2e`, the four existing tests | 4 passed | Rerun after the changes: mobile evidence, edit, approval and reload; dismissal and anonymous denial; desktop layout; adjacent example. Chromium, production server, offline mode. |
| `e2e/conflict.spec.ts` (new) | 1 passed | Two tabs share one browser profile. The second tab's different approval is refused with the conflict message, no "Task created" notice, and the first task unchanged after reload. |
| `npm run build` | Passed | Production build including `/adjacent`. |
| `psql -f tests/postgres.sql` | Passed | Disposable local PostgreSQL with mock Supabase roles. Now also asserts that a second approval for the same owner and conflict raises `unique_violation` (SQLSTATE 23505). This is local and does not exercise hosted Auth or PostgREST. |
| Saved hosted approval still loads | Passed (read-only) | The one existing hosted approval row parses with the new code, loads as **legacy** and **not verified**, and the request ledger still has its one entry. Nothing was written. |
| Gemini model ID and pricing | Verified against the official pricing page on November 9, 2026 | `gemini-3.1-flash-lite`: free tier free of charge; paid tier $0.25 per 1M input tokens and $1.50 per 1M output tokens (thinking tokens count as output). Prices can change; recheck before enabling paid mode. |
| Rendered time format | Tested | `formatTime` is now computed from Halifax clock fields, not ICU locale data. The old output was "4:00 P.M." in en-CA; it is now "4:00 PM". Asserted for 5:30 AM, 2:00 PM, 4:00 PM, 10:00 PM, 12:00 AM and 12:05 PM. |

### Authorization and RLS are separate claims

| Claim | Status |
| --- | --- |
| Application authorization: only `CLEARWEEK_OWNER_ID` may use either private endpoint. | Passed with a **mocked** non-owner token: HTTP 403 from `GET /api/workspace`, `POST /api/workspace` and `POST /api/proposal`, no Gemini client constructed, no database call. Anonymous requests receive 401, in private mode and in demo mode. Earlier (Nov 7) the hosted run also confirmed anonymous denial against the real app. |
| The same check with a **real second hosted account**. | **Not run.** No non-owner test account or credentials exist in the local environment, and I did not create one in the hosted project. Needs a dedicated test account. |
| Row-level security against direct database access. | Verified only on the disposable local database with mock roles (owner-only read, blocked browser writes). The hosted anonymous denial from Nov 7 used the publishable key. **Hosted cross-user RLS with a second user's token has not been tested.** |

The application reaches Postgres only with the server-side secret (service-role) key, which bypasses RLS. Application tests therefore say nothing about RLS, and RLS tests say nothing about the application's owner check.

### Quota behaviour (unchanged, documented)

The request ledger is global to the Supabase project, not per owner: 20 attempts for the lifetime of the ledger, at most 1 attempt per minute and 5 per 24 hours, and a 4,000,000 micro-USD ($4.00) reserved-spend cap. Each attempt reserves 5,000 micro-USD ($0.005) before the provider call and the row is **not released if the call fails**, so failed attempts consume the allowance. A cached suggestion for the same owner and key is returned without consuming it. At 20 attempts the worst-case reserved spend is $0.10, so the attempt count, not the dollar cap, is the binding limit. Nothing was reset or changed.

### Not verified

- No new Gemini call was made in this round. The live Gemini result below is the November 7 run.
- **Public deployment (updated November 9, 2026, after the summary above was first written).** Supabase being hosted never meant the website was deployed. The **offline demo only** is now deployed at <https://clearweek-woad.vercel.app> from commit `661e559` with no environment variables. Checked by `curl` and a real-browser run: `/` and `/adjacent` return 200, `POST /api/proposal`, `GET /api/workspace` and `POST /api/workspace` return 401, `/api/extract` returns 404 (main has no extraction code), and the full core flow (evidence, edit, review, approve, reload, resolution, layouts) ran with 0 browser errors and no request to any host but the deployment. Private mode (Gemini, Supabase) is not deployed and its hosted verification above is unchanged.
- Second-account hosted checks, as above.
- The detailed Brightspace module instructions and rubric remain unavailable.

---

## History: November 7, 2026 first local run

Run on November 7, 2026 with Node.js 26.8.2 and npm 11.19.1. The lockfile pins the tested dependencies.

| Check | Result | Scope |
| --- | --- | --- |
| `npm run lint` | Passed | Next.js and TypeScript ESLint rules. |
| `npm run typecheck` | Passed | TypeScript project checks. |
| `npm test` | 7 passed | Verified overlap, non-overlap, adjacency, midnight, Halifax offsets and daylight-saving gaps and ambiguity. Source IDs, subscribed shift, declined swap, explicit and version-bound approval, replay and separate resolution. Mocked invalid output, untrusted instructions, API failure, retry and reservation rejection. |
| `npm run test:e2e` | 3 passed | Chromium iPhone 13 viewport through evidence, edit, re-review, approval, reload and resolution. Dismissal and anonymous access denial. Desktop column layout. Mobile and desktop captures were visually inspected. |
| `psql -f tests/postgres.sql` | Passed | Disposable PostgreSQL with mock Supabase roles. Migration, duplicate approval constraint, owner-only reads, blocked browser writes and reservations, spend rejection, rate-limit rejection and cache hits. |
| `npm run build` | Passed | Production Next.js build with both server routes. |

The first Playwright capture raced hydration and temporarily changed textarea styling before React attached. The final capture waits for the draft control to become enabled and the mobile test asserts zero browser errors. Local runner permissions were needed for loopback Chromium, Turbopack's CSS worker and Postgres shared memory.

*Superseded later the same day by the hosted follow-up at the end of this file.* Gemini verification used mocked outputs and official documentation. No live Gemini calls, hosted Supabase session, or deployment were verified. The SQL run validates database behavior locally and does not exercise hosted Auth or PostgREST. No paid API usage was initiated. The Brightspace rubric was unavailable.

## History: November 7, 2026 V1.1 and hosted follow-up

| Check | Result | Scope |
| --- | --- | --- |
| Lint, type checking and `git diff --check` | Passed | V1.1 changes, including the hosted smoke runner. |
| Vitest | 9 passed | Includes the real synthetic fixture with an exact shared boundary and a mocked transient Gemini failure with retry disabled. |
| Playwright against `next start` | 4 passed | Original offline approval and reload, dismissal, desktop layout, and the separate synthetic example with no time overlap. |
| Next.js production build | Passed | Includes the static `/adjacent` route. |
| Anonymous requests with private mode enabled | Passed locally | `POST /api/proposal` and `GET /api/workspace` both returned HTTP 401 without credentials. |
| Disposable local PostgreSQL | Passed | Migration, duplicate approval protection, owner row access, denied browser writes, and reservation checks. |
| Live Gemini and hosted Supabase | Blocked at preflight | Missing hosted project URL, publishable and secret keys, owner UUID, Gemini key, and test owner sign-in credentials. No provider call was made. Hosted Auth, save, reload, replay, and post-save access checks remain pending. |

A single idle production-server sample after the local authorization checks showed 0.0% CPU and 138,320 KiB RSS (about 135 MiB). This sample covers the Next.js process only. Build, browser and whole-system peaks were not measured. The showcase uses a prebuilt production server.

The applicable Side Quest Brightspace rubric remains unavailable. See the evidence log for the local files checked.

### Hosted follow-up

After the local credentials were supplied, the production build passed and both anonymous endpoint checks passed. The hosted Supabase preflight returned `PGRST205` for `public.clearweek_actions`. The migration must be applied to the project in `SUPABASE_URL` before retrying. The run stopped before owner sign-in, Gemini generation, or any task write.

After the hosted migration was applied, the one-call Playwright smoke test passed (1 test, 4.8 seconds). A fresh Gemini response had a new hosted usage record with positive input and output token counts. The owner approved the draft, and the task survived reload. Replaying the exact approval left the same single hosted row. Anonymous access was denied through both the application and Supabase. A second signed-in account was outside this run. The test left one follow-up task in the hosted workspace.
