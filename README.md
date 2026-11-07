# ClearWeek

ClearWeek helps Chloe Nguyen review a clash between team travel and her work shift. The historical sample covers Friday, October 23, 2026 in America/Halifax. A draft can become a follow-up task after review and approval. The conflict stays open until Chloe records supporting resolution information.

## Run the offline demo

Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open [ClearWeek on localhost](http://localhost:3000). The default offline demo needs no credentials. It shows a prepared example draft and saves approvals, tasks and resolution records in this browser. Use a fresh browser profile or clear this site's data to start over.

1. Open **View source evidence** in the conflict card.
2. Click **Prepare draft**, edit the message, then click **Review draft**.
3. Click **Approve & create task** and open **Follow-up**.
4. Reload to see the saved task and open conflict. Use **Record a resolution** only if you have supporting information. Use clearly labelled example evidence when rehearsing.

## Private setup

1. Create a Supabase project and apply the migration in `supabase/migrations` through the SQL editor or your linked CLI. Disable public sign-ups and create a dedicated email/password user in Auth. Copy that user's UUID.
2. Copy `.env.example` to `.env.local`. Set `CLEARWEEK_MODE=private`, `CLEARWEEK_OWNER_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`. The publishable key and project URL reach the browser. The secret key stays on the server.
3. In Google AI Studio, create a key for a dedicated project with billing unlinked. Set `GEMINI_API_KEY`, keep `GEMINI_MODE=free`, and use `GEMINI_MODEL=gemini-3.1-flash-lite`. The route refuses models whose pricing has not been built into the guard. Keep all secrets in environment settings.
4. Restart, sign in, and prepare one draft. Confirm the Gemini label, then approve and reload. Verify the owner row and token counts in Supabase. For Vercel, import the project using the Next.js preset, set the same environment variables for private deployments, and repeat this check on the deployed HTTPS URL. A public showcase can use the default demo mode with no secrets.

## Model and budget

Google lists the stable Gemini 3.1 Flash-Lite model with free text usage and standard paid text prices of USD $0.25 per million input tokens and USD $1.50 per million output tokens including thinking. It supports structured output and function calling. ClearWeek uses the official SDK's `models.generateContent` and JSON schema. Write operations stay in the application. [Model reference](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite) · [Pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Structured output](https://ai.google.dev/gemini-api/docs/structured-output) · [Function calling](https://ai.google.dev/gemini-api/docs/function-calling)

The live route accepts only the configured owner, uses a fixed source packet, limits text input to 8 KiB and model output to 256 tokens, and permits one automatic retry on transient failure. Postgres checks the cache and serializes reservations across instances. It permits one reservation per minute, five in 24 hours, and twenty for the project's lifetime. Each reservation covers two attempts at an estimated upper allowance of USD $0.005. Failed calls retain their reservations. At current configured limits, the twenty reservations total USD $0.10. A second lifetime ceiling of USD $4 sits below CAD $10 with room for conversion and tax. Keep the ledger across deploys. Token counts and indicative USD cost are stored when Gemini returns usage on a valid response.

Keep paid mode off for this project by default. If the owner later elects to use paid mode, first verify the dedicated project's cap in AI Studio and check the CAD total including conversion and taxes. Only then set `GEMINI_MODE=paid` and `GEMINI_PAID_CAP_VERIFIED=true`. Google describes project caps as monthly and subject to enforcement delay. The app's lifetime reservations are estimates and do not cap provider billing or calls made with the key outside ClearWeek. [Google billing and spend caps](https://ai.google.dev/gemini-api/docs/billing/)

## Architecture and limits

The Next.js App Router renders the workspace. Temporal resolves local dates and rejects daylight-saving gaps and ambiguous times. The overlap calculation and evidence references are deterministic. Gemini picks the message framing and supporting details from a small vocabulary. Zod rejects unknown fields and sources, and the application renders the factual sentences. There is one follow-up per conflict. In private mode, an owner-scoped database row holds the approval, task and audit outcome atomically. Resolution is stored as a separate action with user-supplied evidence. Row-level rules restrict reads to the owner, while authenticated browser clients have no direct write grants.

The demo uses one historical day and browser storage. The app has no live calendar import, messaging, employer schedule changes, ShiftPal access, or phone access. Resolution notes are user attestations. Hosted Supabase, live Gemini and a deployed URL require external setup and separate verification.

## Checks and handoff

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The [SQL checks](tests/postgres.sql) run with `psql -f tests/postgres.sql` in a fresh disposable Postgres database as its administrator. They create mock Supabase roles and an Auth schema. See the [test results](docs/test-results.md), [source evidence](docs/evidence.md), [work plan](docs/plan.md), [decisions](docs/decisions.md), [pitch](docs/pitch.md), and [demo script](docs/demo-script.md).
