# ClearWeek project submission

**Alamedin Sabit** · SideQuest · Persona-driven AI agent

**Shareable project link:** <https://github.com/Lameda12/ClearWeek> (public). **Live offline demo:** <https://clearweek-woad.vercel.app> (offline mode only, sample data, no AI calls, no secrets; verified November 9, 2026 as described in the [README](../../README.md)). The Gemini and Supabase private mode is not deployed. Setup for it is in the [showcase README](../../README.md).

## How the build answers the pitch

I built the workflow around Chloe’s October 23, 2026 conflict. ClearWeek calculates the 4–6 PM overlap and cites the calendar and declined swap. Chloe can prepare a draft asking Dana about coverage, edit it, and review the exact version before approving. Approval saves one follow-up task. The conflict stays open until Chloe separately records supporting information about the outcome.

## What I verified

Details and dates are in the [verification record](../test-results.md); redacted hosted records are in the [hosted evidence](../hosted-evidence.md).

- **November 7, hosted:** one fresh Gemini response with recorded token usage, and one approved task that survived reload in hosted Supabase. A replay of the same approval left one row. Anonymous access was denied by the app and by Supabase. That task was saved before provenance checks, so it now loads as *legacy, not verified*.
- **November 9, local:** lint, type checking, 28 unit tests, the four original browser tests (rerun after the changes) plus one new conflict test, the production build, and disposable PostgreSQL checks passed. Model failure and retry tests use mocks. No new Gemini call was made.
- **Not verified:** a real second hosted account and hosted row-level security with a second user's token. A mocked non-owner token returns 403 on both private endpoints with no provider call. Only the offline demo is publicly deployed; private mode is not.

## What changed and why

- I kept the original historical case and added a separate synthetic example to show how the detector treats commitments with an exact shared boundary.
- I moved the showcase to a prebuilt production server after reporting high resource use when launching the app.
- I added a one-attempt hosted check to separate fresh Gemini output from the offline example and to exercise save and replay.
- **Review follow-up (Nov 9):** I found that editing a Gemini draft left it labelled as Gemini's, that a different approval after a task existed was silently dropped, and that the browser's claim of origin was trusted. Drafts now record their source separately from "edited", unedited Gemini drafts carry a server-issued proof, a different approval returns a conflict, and old rows are marked unverified instead of upgraded. I also replaced locale-dependent time formatting (it rendered "4:00 P.M.") with a deterministic format, and corrected my documentation where it implied row-level security protected the app (the app uses a server-side key that bypasses it).

## Limits

ClearWeek uses fixed sample schedules. It checks calendar overlap and leaves travel time outside that calculation. It prepares a message draft and saves a follow-up without contacting Dana or changing the shift. The offline mode uses a prepared example draft and browser storage. I verified the hosted workflow for the owner and anonymous requests. Second-account checks against the hosted project and public deployment remain unverified.

[Evidence log](../evidence.md) · [Verification record](../test-results.md) · [AI-use appendix](ai-use.md)
