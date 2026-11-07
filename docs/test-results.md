# ClearWeek verification

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

Gemini verification used mocked outputs and official documentation. No live Gemini calls, hosted Supabase session, or deployment were verified. The SQL run validates database behavior locally and does not exercise hosted Auth or PostgREST. No paid API usage was initiated. The Brightspace rubric was unavailable.
