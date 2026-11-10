# ClearWeek showcase drafts

**Alamedin Sabit** · SideQuest · Persona-driven AI agent

**DRAFT. Nothing here has been posted or submitted.** Every claim below is taken from the [README](../../README.md), the [verification record](../test-results.md) or the [research note](../research-note.md). Links: repository <https://github.com/Lameda12/ClearWeek>, live offline demo <https://clearweek-woad.vercel.app>.

## Summary for the Brightspace text box (3 sentences)

ClearWeek is an AI-assisted scheduling workflow I built for Chloe Nguyen, a nursing student, varsity swimmer and part-time cashier whose team bus (2 to 6 PM) and work shift (4 to 10 PM) overlap on Friday, October 23, 2026 after her swap request was declined: deterministic code finds the two-hour overlap and shows its sources, Gemini (private mode only) makes one constrained choice about how to frame a draft to her manager, and Chloe reviews, edits and approves it to create a follow-up task while the conflict stays open until she records the outcome. The public demo is offline, uses sample data and makes no AI calls, and it does not contact anyone, send messages or change shifts. Local checks passed on November 9 (lint, type checking, 28 unit tests, five browser tests, a production build and disposable PostgreSQL checks) and a hosted run with a live Gemini response passed on November 7, but a second hosted account and hosted row-level security with a second user's token were not tested.

## LinkedIn-style post (DRAFT)

I built ClearWeek for SideQuest's Persona-driven AI agent stream.

The persona is Chloe, a nursing student who swims and works part-time. On Friday, October 23, her team bus (2 to 6 PM) and her shift (4 to 10 PM) overlap, and her swap request was declined. ClearWeek finds the two-hour overlap, shows where each fact came from, and helps her prepare a message to her manager. She reviews and edits it, then approves it to save a follow-up task. The conflict stays open until she records what actually happened.

The AI part is deliberately small. Deterministic code finds the conflict. In private mode, Gemini makes one constrained choice about how to frame the draft, and the server writes every factual sentence from source-backed wording. It does not plan on its own, send messages or change shifts.

What I verified, and what I did not:
- The offline demo is public and uses sample data with no AI calls. Local checks passed on November 9, and a hosted run with a live Gemini response passed on November 7.
- I did not test a second hosted account, and private mode is not deployed publicly.
- I also tried a small fine-tuned model for pulling schedule phrases out of pasted messages. It scored well on public calendar dialogues but was not reliable on ClearWeek-style messages, so it is not enabled.

I used AI coding assistants for the build; the appendix in the repo says which and for what.

Demo: https://clearweek-woad.vercel.app
Code: https://github.com/Lameda12/ClearWeek

## Before posting or submitting

- The demo video is not recorded yet. Add its link to the post only after it exists.
- Re-check the live demo link still loads.
- Post and paste only when you decide to; nothing is scheduled or sent.
