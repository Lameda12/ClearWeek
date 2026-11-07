# ClearWeek implementation plan

Build a historical, single-day scheduling assistant with one complete review and approval workflow. This is provisional pending the Brightspace rubric.

1. Encode source-linked events and detect overlaps with explicit local timestamps, tested at interval and timezone boundaries.
2. Build a responsive schedule, evidence and action workspace, and verify keyboard and mobile interaction.
3. Add a demo draft and a guarded Gemini adapter. Use a constrained vocabulary for model output and render factual text from source records.
4. Bind each explicit approval to a review version. Save task, approval and history atomically, with duplicate protection. Store a separate resolution record only after explicit evidence entry.
5. Run unit and browser tests, lint, type checking and a production build. Document external setup and prepare rehearsal materials.

The App Router serves the interface and typed endpoints. Browser storage supports the offline demo. A private Supabase-backed mode verifies Auth sessions, applies row-level access rules and uses Postgres to serialize model reservations. Gemini never authorizes writes.

Risks include ambiguous screenshot details, incorrect dates, unsupported model claims, duplicate approvals, and concurrent spending. Address these with source references, strict timezone parsing, constrained output, uniqueness constraints, and atomic reservations.

Done means the evidence-backed sample works through approval and reload on mobile, checks are recorded, and live credentials or deployment gaps are explicit.

## Participant work log

| Date | Module | What I did | Time spent | Evidence or link |
| --- | --- | --- | --- | --- |
| | Pitch | | | |
| | Work plan | | | |
| | Build | | | |
| | Showcase | | | |
