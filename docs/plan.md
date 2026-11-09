# ClearWeek implementation plan

Build a historical, single-day scheduling assistant with one complete review and approval workflow. This is provisional pending the Brightspace rubric.

1. Encode source-linked events and detect overlaps with explicit local timestamps, tested at interval and timezone boundaries.
2. Build a responsive schedule, evidence and action workspace, and verify keyboard and mobile interaction.
3. Add a demo draft and a guarded Gemini adapter. Use a constrained vocabulary for model output and render factual text from source records.
4. Bind each explicit approval to a review version. Save the approved follow-up as one action row, with duplicate protection from the table's primary key (an exact replay is idempotent; anything different is a conflict). The action history shown in the app is derived from the saved rows; there is no separate history table. Store a separate resolution row only after explicit evidence entry.
5. Run unit and browser tests, lint, type checking and a production build. Document external setup and prepare rehearsal materials.

The App Router serves the interface and typed endpoints. Browser storage supports the offline demo. A private Supabase-backed mode verifies Auth sessions, applies row-level access rules and uses Postgres to serialize model reservations. Gemini never authorizes writes. The app's database access uses the server-side secret key, so access control is the owner check; RLS protects direct database access and is a separate guarantee.

Risks include ambiguous screenshot details, incorrect dates, unsupported model claims, duplicate approvals, and concurrent spending. Address these with source references, strict timezone parsing, constrained output, uniqueness constraints, and atomic reservations.

Done means the evidence-backed sample works through approval and reload on mobile, checks are recorded, and live credentials or deployment gaps are explicit.

## Participant work log

| Date | Module | What I did | Time spent | Evidence or link |
| --- | --- | --- | --- | --- |
| | Pitch | | | |
| | Work plan | | | |
| | Build | | | |
| | Showcase | | | |

## V1.1

- Preserve Chloe's workflow. Add a separate synthetic example that uses the same overlap calculation.
- Run the showcase and browser tests against the production server so the demo session does not run the development watcher.
- Gate the hosted smoke test behind explicit free-tier confirmation and a fresh owner workspace. Verify authorization, provider usage, approval replay and hosted persistence. Record missing credentials as a blocker.

## V1.2 (November 9, 2026)

- Split draft source from an `edited` flag. Unedited Gemini drafts carry a server HMAC proof; edited drafts carry their verified original. Never trust a client-supplied origin. Require fresh review after any edit.
- Return HTTP 409 for any approval or resolution that differs from the saved one; keep exact replay idempotent. Offline mode raises the same conflict.
- Load rows saved before these fields as legacy and unverified. No migration: the new fields live in the existing `payload` column, so the applied migration and hosted data are untouched.
- Render times deterministically. Verify the model ID and prices against the provider's pricing page.
- Publish only reviewed files, with the offline demo as the public deployment and no Gemini or Supabase secrets on it. Verify the deployed URL before documenting it. **Status: blocked on go-ahead to create the public repository and deployment.**
- Budget: CAD $10 total. Private mode stays on the free tier; no new paid service; no extra Gemini calls for these changes.
