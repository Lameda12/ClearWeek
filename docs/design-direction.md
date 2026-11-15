# ClearWeek design direction

One idea: a swim-meet heat sheet. Times are the content, so they are set like a timetable, and the one loud thing on the page is the overlap itself, drawn to scale.

- **Type:** Archivo only (variable, width axis). Headings at 87.5% width, weight 700; body at 100% width, weight 400; all times in tabular figures. No second typeface.
- **Scale:** 12 / 14 / 16 / 20 / 28–44px (h1 fluid). Body is 16px so phone inputs never zoom. Line height 1.5 body, 1.15 headings.
- **Colour tokens** (`app/globals.css`, nothing hard-coded elsewhere):
  `--ground #f1f5f5` deck, `--surface #ffffff`, `--ink #0f2b33`, `--muted #4a626a`, `--line #d3dfe0`,
  `--water #0f6477` links and focus, `--water-deep #0c3a46` top bar and primary button,
  `--flag #7a4406` on `--flag-wash #fff3dc` for the conflict only,
  `--ok #1f5c3d` on `--ok-wash #e6f4ec` for saved and resolved, `--danger #8b2a25` on `--danger-wash #fdf1f0` for errors.
- **Colour rule:** amber means the conflict and nothing else. Green means saved. Red means an error with a way out.
- **Spacing:** 4px base: 4, 8, 12, 16, 24, 32, 48. Panels pad 24 (16 on phones); gaps between panels 16.
- **Radius:** 8 on controls and rows, 14 on panels, full on status pills. One border style: 1px `--line`.
- **Layout:** left-aligned, 1140px max. Two columns from 761px; one column below, with the conflict reachable from a link in the intro.
- **Motion:** only in answer to an action. A 120ms 1px press on buttons (colours change instantly); 200ms fade and 6px rise when the draft, the saved task or an error appears; the evidence chevron turns. Nothing moves on load or scroll. All of it is off under `prefers-reduced-motion`.
- **States:** every async button names what it is doing ("Preparing draft…"). Every error sits in the card that caused it and offers the next step. Focus moves to whatever just appeared.
- **Copy:** button labels stay exactly as in the demo script. Sentence case, plain verbs, no apology.
