# ClearWeek screen recording

**Alamedin Sabit** · About 75 seconds

Record in offline mode in a fresh browser profile. The mode badge should say **Offline demo**. Label the recording as a demonstration with sample data and **no live AI call**: the draft is a prepared example. Keep dashboards and credentials out of frame.

To substantiate the earlier live Gemini response, show the redacted [hosted evidence](hosted-evidence.md) instead of re-recording. A fresh Gemini run is currently blocked by fixture state (the owner already has an approved task and a cached suggestion, and the global ledger allows 5 attempts per day and 20 in total), not by design. No cache reset or extra provider call is needed for the recording.

| Time | Exact clicks | What I say |
| --- | --- | --- |
| 0–12 s | Open ClearWeek. Point to **Chloe’s Friday schedule** and **Historical sample**. | “I’m Alamedin Sabit. I built ClearWeek for Chloe, a nursing student who swims and works part-time. This is a demonstration with sample data and no live AI call.” |
| 12–28 s | Point to **Team bus to Saint John** and **Harbour Foods shift**. Click **View source evidence**. | “Her bus and shift overlap from four to six. This notification shows her swap was declined.” |
| 28–50 s | Click **Prepare draft**. Point to the mode label and draft. Click **Review draft**, then **Approve & create task**. | “I can ask Dana about coverage. This is the offline example draft. I review this version and approve it to save a follow-up.” |
| 50–65 s | Click **View saved follow-up**. Reload with **⌘R**. Scroll back to **Follow-up tasks** if needed. | “The follow-up is still here after reload.” |
| 65–75 s | Scroll to **Conflict open**. | “ClearWeek saves a follow-up. Chloe still has to contact Dana and confirm what happened.” |

Do not say Gemini wrote the offline draft. In the offline recording the task persists in the current browser. The hosted workflow, verified earlier, persisted in hosted Supabase.
