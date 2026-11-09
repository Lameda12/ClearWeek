# Hosted verification evidence (redacted)

This is the record behind the "one live Gemini response and one saved task" claim. It comes from the hosted Supabase project used on November 7, 2026, read again read-only on November 9, 2026. Project URL, keys, user identifiers, emails, tokens and row IDs are deliberately left out. Hosted Supabase is a database and sign-in service; it does not mean the ClearWeek website is publicly deployed.

| Item | Redacted observation |
| --- | --- |
| Request ledger (`clearweek_ai_requests`) | 1 row, created 2026-11-07. Reserved 5,000 micro-USD. Provider usage recorded: 314 input tokens and 32 output tokens. Estimated cost 127 micro-USD (about $0.000127 at the paid-tier rates; the call ran in free mode, so the billed amount is expected to be zero). |
| Stored suggestion | `framing: "guidance"`, `details: ["swap", "availability"]`. This is the constrained output the server validated; the user-facing text was assembled by ClearWeek from fixed wording. |
| Saved approval (`clearweek_actions`) | 1 `approve` row, created 2026-11-07. No `resolve` row. |
| Replay | The Nov 7 smoke run replayed the exact approval and found the row unchanged. |
| Anonymous access | Denied through the app (HTTP 401) and through Supabase with the publishable key on Nov 7. |

## What this does and does not prove

- It shows one fresh Gemini response was recorded and one approval persisted and survived reload. It was a single free-tier attempt with retries disabled.
- The approval was saved **before** provenance checks existed. ClearWeek now loads it as *legacy*: "Saved before provenance checks · recorded as Gemini-assisted, not verified". It does not claim the saved text is proven to have come from Gemini, and this record is not retroactive proof.
- A fresh Gemini run with the same owner is currently blocked by fixture state, not by design: the owner already has an approved task and a cached suggestion for this fixture and model, and the global ledger allows 5 attempts per 24 hours and 20 in total. A new run would need a fresh test owner and ledger entry. No additional provider call was made for the showcase.
