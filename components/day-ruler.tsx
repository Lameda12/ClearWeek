import type { CSSProperties } from "react";
import type { ScheduleView } from "@/lib/schedule-view";

// One look per category, from the Figma bars.
const tone: Record<string, string> = {
  Swim: "bg-[var(--lane-swim)] border-[var(--water)]",
  School: "bg-[var(--water-wash)] border-[var(--muted)]",
  Work: "bg-[var(--lane-work)] border-[var(--flag)]",
};
// From md the lane names take 224px plus an 8px gap, and the plot is what is left. On a phone the plot is the full width.
const plot = "absolute inset-0 md:left-[232px]";

type Props = { day: ScheduleView["day"]; conflict: ScheduleView["conflict"] };

export function DayRuler({ day, conflict }: Props) {
  const clash = day.lanes.flatMap((lane, index) => (lane.overlaps ? [index] : []));
  // On a phone the band wraps only the lanes that collide; from md it runs the full height, as drawn.
  const first = clash[0] ?? 0;
  const last = clash.at(-1) ?? 0;
  const band = { "--top": `${first * 72 + 38}px`, "--height": `${(last - first) * 72 + 36}px` } as CSSProperties;

  return <section id="schedule" tabIndex={-1} aria-label="Day schedule" className="scroll-mt-4">
    <figure className="m-0">
      <figcaption className="sr-only">{day.summary}</figcaption>
      <div className="relative h-7 md:h-9" aria-hidden="true">
        {conflict && <div className={plot}>
          <span className="absolute top-0.5 w-[140px] -translate-x-1/2 text-center text-[length:var(--text-small)] leading-5 font-semibold text-[var(--flag)] md:top-0" style={{ left: conflict.band.center }}>{conflict.label}</span>
        </div>}
      </div>

      <div className="relative">
        <div className={`${plot} pointer-events-none`} aria-hidden="true">
          {day.ticks.map(tick => <span key={tick.label} className="absolute inset-y-0 w-px bg-[var(--line)]" style={{ left: tick.left }} />)}
          {conflict && <span style={{ ...band, left: conflict.band.left, width: conflict.band.width }}
            className="absolute top-[var(--top)] h-[var(--height)] rounded-md border-2 border-[var(--flag)] bg-[var(--flag-wash)] md:top-[-6px] md:h-[calc(100%+6px)]" />}
        </div>
        <ol className="relative m-0 list-none p-0">
          {day.lanes.map(lane => <li key={lane.id} className="grid border-b border-[var(--line)] pb-[3px] md:h-14 md:grid-cols-[224px_1fr] md:items-center md:gap-x-2 md:pb-0">
            <div>
              <p className="text-[length:var(--text-small)] leading-5 font-semibold text-[var(--ink)]">{lane.title}</p>
              <p className="text-[length:var(--text-small)] leading-5 text-[var(--muted)] tabular-nums">{lane.time[0]} – {lane.time[1]}</p>
            </div>
            <div className="relative mt-1 h-6 md:mt-0" aria-hidden="true">
              <span className={`absolute inset-y-0 rounded-md border ${tone[lane.category] ?? tone.School}`} style={{ left: lane.left, width: lane.width }} />
            </div>
          </li>)}
        </ol>
      </div>

      <div className="mt-2 grid md:h-8 md:grid-cols-[224px_1fr] md:gap-x-2">
        <div className="relative h-5 md:col-start-2 md:row-start-1" aria-hidden="true">
          {day.ticks.map(tick => <span key={tick.label} className="absolute top-0 w-14 -translate-x-1/2 text-center text-[length:var(--text-small)] leading-5 text-[var(--muted)] tabular-nums"
            style={{ left: `clamp(28px, ${tick.left}, calc(100% - 28px))` }}>{tick.label}</span>)}
        </div>
        <p className="mt-8 text-[length:var(--text-small)] leading-5 text-[var(--muted)] md:col-start-1 md:row-start-1 md:mt-0">Work calendar: view only, cannot be edited here.</p>
      </div>
    </figure>
  </section>;
}
