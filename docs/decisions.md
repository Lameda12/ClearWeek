# ClearWeek decisions

- Use the October 23, 2026 persona day in America/Halifax. The original screenshot assets stay outside the shipped app.
- Use a small fixed set of grounded message lines. Gemini interprets the scenario notes and selects a framing and supporting details. This lets the server reject invented facts and actions structurally.
- Keep demo storage in the current browser. Private mode uses an owner account, a server-only database key, and owner-scoped Postgres rows. No public sign-up is required.
- Default to offline mode. Start live trials with a dedicated Gemini free-tier project. Cache suggestions by model and fixture version. Paid usage requires explicit operator configuration and a verified provider cap.
- This folder was untracked inside a parent home-directory Git repository. Use a dedicated project repository so project files can be committed without touching the parent repository.
- November 9, 2026: Drafts have a `source` (`demo` or `gemini`) and a separate `edited` flag. Unedited Gemini drafts carry an HMAC proof issued by the server, keyed from the existing server-only Supabase secret; edited drafts carry their original with its proof. Chosen over a proposals table so no new migration touches the hosted database. Rotating the secret makes old proofs unverifiable, and those tasks then display as not verified.
- Rows saved before this change are legacy. They are shown as "recorded as Gemini-assisted, not verified" and are never upgraded.
- Approval conflicts: exact replay (same version and text) is idempotent; anything else returns HTTP 409. The primary key makes the first writer win. A forged or altered draft is rejected earlier with 400 because its proof fails.
- The public deployment is the offline demo with no secrets. Private mode is not deployed publicly.
- Quotas and ledger counters are not reset or changed by these fixes.
