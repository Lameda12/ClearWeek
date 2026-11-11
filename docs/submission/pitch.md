# ClearWeek project pitch

**Alamedin Sabit** · SideQuest · Persona-driven AI agent

*This is the pitch as written before the build. It has been updated only for clarity: plainer words, evidence described in words, and future tense.*

## The problem

I plan to build ClearWeek for Chloe Nguyen, a nursing student, varsity swimmer, and part-time cashier. Her class, team, and work commitments can all be on a calendar. When two of them collide, she still has to piece together what happened and what to do. I will focus on one moment: a swap for her work shift fell through, and she needs a next step.

## What Chloe's schedule shows

- Her team calendar shows the team bus to Saint John from 2 to 6 PM.
- Her work calendar shows a Harbour Foods shift from 4 to 10 PM on Friday, October 23, 2026. That calendar is read-only, so she cannot change the shift there.
- A notification says her swap for that Friday was declined and she is still scheduled.
- The bus and the shift overlap for two hours, from 4 to 6 PM, in Halifax time.
- Her work reminders show that an availability update is overdue. They also show that Dana is the store manager.

## What ClearWeek will do

ClearWeek will be a web page. Chloe opens it and sees her Friday as a list: swim practice, class, the bus, and the shift. Next to the list she sees one flagged conflict: "2 hours overlap, 4 to 6 PM". She can open a list of evidence to check where each fact came from, such as the declined swap notice. She then clicks "Prepare draft" and gets a short message asking Dana whether approved coverage is possible. She can edit the message, review the final version, and approve it. Approving saves a follow-up task in ClearWeek. The task stays open and the conflict stays open until Chloe writes down what Dana confirmed.

## What it is built with

I plan to build a web app, not a chatbot, in TypeScript with Next.js and React. Plain code that does the math, with no AI, will find the overlap. Gemini, Google's AI model, will be used only in the signed-in version, in one small step described next. I will also make an open demo with no sign-in and no AI calls, using sample data from Chloe's October 2026 screenshots.

## Where AI fits

In the signed-in version, Gemini will make one narrow choice. It will pick one of two ways to word the ask (ask for coverage, or ask for guidance) and up to two verified details to include. The server will check that choice. The server will write every sentence about times, places, and the swap. Gemini will not send anything, will not use tools, and will not change any shift. ClearWeek is an AI-assisted workflow, not an AI that plans on its own.

## How I will show it works

I will run the open demo on Chloe's Friday case. I will show the 4 to 6 PM overlap and where each fact came from. I will show the draft to Dana, then approve it and show the follow-up task, which stays open. Vitest tests will check the overlap math and the approval rules. Playwright tests will click through the open demo in a real browser.

## Where I draw the line

ClearWeek will use sample data only. It will have no live calendar connection, will not send messages, and will have no access to the employer's scheduling system. Chloe stays responsible for contacting Dana and confirming what happens. A second declined swap, for Saturday, October 24, from 9 AM to 3 PM, is a later case and is not in scope now.
