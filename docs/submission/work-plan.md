# ClearWeek work plan

**Alamedin Sabit** · SideQuest · Persona-driven AI agent  
**Updated November 11, 2026**

ClearWeek is a web app that helps Chloe Nguyen, a nursing student, varsity swimmer, and part-time cashier, decide what to do when her team bus and her work shift overlap. This plan lists the work in date order, from the pitch to the showcase. It will change if feedback changes what gets built.

## Timeline

Dates come from git times (Halifax time), except Nov 8, which I confirmed myself, and the Nov 7 online check, which comes from my test notes.

| When | Stage | What I did or will do | Status |
| --- | --- | --- | --- |
| Nov 7, 2:16 PM | Build | First working version: Chloe's Friday schedule, a list of evidence, and a draft that she reviews and approves. Approving saves a follow-up task in the browser. Saved as `03a574f`. | Done |
| Nov 7 | Build | Online check with Gemini and Supabase: one fresh Gemini response, and one approved task that was still there after a reload, saved in the online database. The date is from my verification record. | Done |
| Nov 8 | Pitch | Review Chloe's screenshots, choose one conflict, write the pitch. | Done. The pitch was approved. |
| Nov 8 | Work plan | Write and submit the first work plan. | Done. Feedback received. |
| Nov 9, 4:29 PM | Build | Fixes after my own review. The app now records where each draft came from and no longer trusts the browser's claim. A different second approval is refused with a clear message. Times show as "4:00 PM". Tests added. Saved as `b43fbeb`. | Done |
| Nov 9, 6:30 to 6:34 PM | Build | Public code repository and an open demo online (no sign-in, no AI calls). Saved as `661e559` and `0f5d4e9`. | Done |
| Nov 9, 7:56 to 8:30 PM | Showcase | Pitch PDF regenerated, AI use table and showcase text drafted, README block added. Nothing posted. Saved as `48532b2` to `4e16cd0`. | Done (drafts) |
| Nov 11 | Pitch, work plan | Rewrite the pitch, work plan, README, and demo script in plain words after the reviewer feedback. Not yet saved to git. | In progress |
| After the rewrite | Build | Run the online checks with a real second account. | Not started |
| After the rewrite | Showcase | Read the full SideQuest instructions and check all links. | Not started |
| Before the showcase deadline | Showcase | Record the 2 minute demo (see Demo plan). | Not started |
| Before the showcase deadline | Showcase | Submit. Projects close Fri Nov 27, 2026 (kickoff meeting). | Not started |

## Stack

- **Next.js, React, TypeScript:** the web page Chloe sees and the server code behind it.
- **Zod:** checks that every input has the expected shape before the app uses it.
- **Gemini:** the AI step in the signed-in version. It picks how to word the message to Dana. It does not write facts.
- **Supabase:** sign-in and the online database where the approved follow-up is saved.
- **Vitest and Playwright:** automatic tests. Vitest tests the logic. Playwright clicks through the app in a real browser.
- **Git:** version control, so every change is recorded.

## Demo plan

I will record the open demo: no sign-in and no AI calls. No account details or keys can appear on screen. The recording will take about 2 minutes and show these steps in order:

1. Open the app and show Chloe's Friday schedule.
2. Point to the 2 hour overlap, 4 to 6 PM.
3. Open the evidence list and check where each fact came from, including the declined swap.
4. Click "Prepare draft", then edit the message to Dana.
5. Click "Review draft", then "Approve & create task".
6. Open the follow-up and reload the page. The task is still there, and the conflict is still open.

The signed-in Gemini version will not be in the recording. I will only describe it in the README.

## Hours by stage

These are my actual hours so far. The last column is only an estimate from commit times. Git shows when work was saved, not how long it took, so these are lower bounds.

| Stage | Planned | Actual | Estimate from commit times |
| --- | --- | --- | --- |
| Pitch | 2.5 hours (shared with the work plan) | 2 hours | No git entries. No estimate. |
| Work plan | included in the 2.5 above | 1.5 hours | No git entries for the first version. No estimate. |
| Build | 8 hours | 9 hours | At least 2 hours on Nov 9 (first entry 4:29 PM, last build entry 6:34 PM). Nov 7 has one entry at 2:16 PM and no start time, so it is unknown. |
| Showcase | 2 hours | 1 hour so far, recording not made yet | About 0.5 hour on Nov 9 (7:56 to 8:30 PM). |
| **Total** | **12.5 hours** | **13.5 hours so far** | Git times alone cover about 4 hours on Nov 9 (4:29 to 8:30 PM, including the side experiment). They cannot show the rest. |

The original plan had four weeks: week 1 for the pitch and scope (2.5 hours), week 2 for the build (5), week 3 for checking the online version (3), and week 4 for the README and recording (2). I grouped weeks 2 and 3 as Build.

## AI use log

I first drafted the "what it got wrong" and "how I checked it" cells from commit messages, test files and my own docs. I then confirmed or corrected each one.

| Date | Task | What AI did | What it got wrong | How I checked it |
| --- | --- | --- | --- | --- |
| Nov 7 | First working version | Codex turned my brief into the first prototype, tests, and notes (`03a574f`). | The app trusted the browser's word about where a draft came from. An edited Gemini draft kept the Gemini label. A different second approval was dropped with no message. Times showed as "4:00 P.M." | I found these in my Nov 9 review. Each fix got a test. |
| Nov 7 | Online check | Helped set up and run the check against Gemini and Supabase. | The first run failed because I had not applied the database setup. Not an AI error. | I applied the setup and ran the check again. The result is in the online-run evidence file. |
| Nov 9 | Fix where each draft came from, duplicate approvals, old rows | Claude Code made the fixes (`b43fbeb`). | Nothing I know of. | I added tests for repeat approvals, conflicts, edits, tampering and old rows. I added a two-tab browser test and a database check for a second approval. All passed, and the production build passed. |
| Nov 9 | Documents | Claude Code wrote the verification, evidence, and submission documents (`8b4d791`). | It named helper functions that do not exist in the code. I had them renamed. The first docs also implied the database's per-user access rules protected the app. I corrected that in the verification record. | I compared the docs with the code and the tests. |
| Nov 9 | Extraction experiment | Claude Code helped build a small side experiment on a separate branch. | The small model was not reliable on ClearWeek-style messages. | I wrote the results and limits in the research note. It is not part of the app. |
| Nov 11 | Rewrite of pitch, work plan, README, demo script | Claude Code rewrote them from the reviewer feedback. | Nothing I found. | I read the changes. I found nothing wrong. |

## What was hard

The hardest part was checking the AI's work. It built something that looked finished, but I found the app trusted the browser about where a draft came from, and the AI had also named functions that do not exist. The second hard part was explaining it in plain words, because the reviewer said my terms were unclear.

## What is still open

- Online checks with a real second account have not been run. A mocked non-owner passes, but a real one is untested.
- The demo recording has not been made.
- I have not done a full review of the SideQuest instructions.
