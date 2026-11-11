# ClearWeek showcase drafts

**Alamedin Sabit** · SideQuest · Persona-driven AI agent

**DRAFT. Nothing here has been posted or submitted.** Every claim below is taken from the [README](../../README.md), the [verification record](../test-results.md) or the [research note](../research-note.md). Links: repository <https://github.com/Lameda12/ClearWeek>, live open demo <https://clearweek-woad.vercel.app>.

## Summary for the Brightspace text box (3 sentences)

ClearWeek is a web app I built (TypeScript, Next.js, React) for Chloe Nguyen, a nursing student, varsity swimmer and part-time cashier whose team bus (2 to 6 PM) and work shift (4 to 10 PM) overlap on Friday, October 23, 2026 after her swap request was declined: plain code that does the math, with no AI, finds the two-hour overlap and shows where each fact came from, Gemini (signed-in version only) makes one small choice about how to word a draft to her manager, and Chloe reviews, edits and approves it to create a follow-up task while the conflict stays open until she records the outcome. The open demo needs no sign-in, uses sample data and makes no AI calls, and the app does not contact anyone, send messages or change shifts. Local checks passed on November 9 (lint, type checking, 28 unit tests, five browser tests, a production build and disposable PostgreSQL checks) and an online run with a live Gemini response passed on November 7, but a second online account, and the online database's per-user access rules with a second user's token, were not tested.

## LinkedIn-style post (DRAFT)

I built ClearWeek for SideQuest's Persona-driven AI agent stream.

The persona is Chloe, a nursing student who swims and works part-time. On Friday, October 23, her team bus (2 to 6 PM) and her shift (4 to 10 PM) overlap, and her swap request was declined. ClearWeek finds the two-hour overlap, shows where each fact came from, and helps her prepare a message to her manager. She reviews and edits it, then approves it to save a follow-up task. The conflict stays open until she records what actually happened.

The AI part is deliberately small. Plain code that does the math finds the conflict. In the signed-in version, Gemini makes one small choice about how to word the draft, and the server writes every factual sentence from wording tied to the evidence. It does not plan on its own, send messages or change shifts.

What I verified, and what I did not:
- The open demo is public, needs no sign-in, and uses sample data with no AI calls. Local checks passed on November 9, and an online run with a live Gemini response passed on November 7.
- I did not test a second online account, and the signed-in version is not deployed publicly.
- I also tried a small fine-tuned model for pulling schedule phrases out of pasted messages. It scored well on public calendar dialogues but was not reliable on ClearWeek-style messages, so it is not enabled.

I used AI coding assistants for the build; the appendix in the repo says which and for what.

Demo: https://clearweek-woad.vercel.app
Code: https://github.com/Lameda12/ClearWeek

## Before posting or submitting

- The demo video is not recorded yet. Add its link to the post only after it exists.
- Re-check the live demo link still loads.
- Post and paste only when you decide to; nothing is scheduled or sent.
