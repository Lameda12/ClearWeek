# ClearWeek project pitch

**Alamedin Sabit** · SideQuest · Persona-driven AI agent

## The problem

I built ClearWeek for Chloe Nguyen, a nursing student, varsity swimmer, and part-time cashier. Her class, team, and work commitments can all be on the calendar, yet she still has to piece together what happened when two of them collide. I focused on the point where a student athlete with a shift job needs to decide what to do after a swap falls through.

## What I found

In the Chloe persona file, `image17.png` shows the team bus to Saint John from 2 to 6 PM and the Harbour Foods shift from 4 to 10 PM. The shift detail in `image10.png` confirms Friday, October 23, 2026 and shows that the work calendar is a read-only subscription. The notification in `image2.png` says the Friday swap was declined and Chloe was still scheduled. The schedule therefore shows a two-hour overlap from 4 to 6 PM in Halifax. The work reminders in `image4.png` and `image5.png` also show an overdue availability update and identify Dana as the store manager.

## What I want ClearWeek to do

I want Chloe to see the conflict, check where it came from, and prepare a practical next step in one place. ClearWeek calculates the overlap and offers a draft asking Dana about approved coverage. ClearWeek is an AI-assisted workflow, not an autonomous planner: deterministic code finds the overlap, and in private mode Gemini makes one constrained choice of framing and which verified details to include while the server writes every factual sentence. The public demo makes no AI calls. Chloe can edit the message, review the version she wants, and approve it to create a follow-up task in ClearWeek.

## Where I draw the line

The project uses a historical sample. Chloe remains responsible for contacting Dana and confirming what happens. ClearWeek keeps the conflict open until she records supporting information about the outcome. The prototype uses sample data and has no live calendar connection, message sending, or employer scheduling access.
