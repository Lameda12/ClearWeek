import { currentConflicts, evidence, formatTime, instant, listEvents } from "./scenario";

/**
 * Everything the workspace screen shows about the day, already formatted.
 * Built on the server so the browser never downloads the Temporal polyfill.
 */
export type ScheduleView = {
  events: { id: string; title: string; category: string; time: [start: string, end: string]; readOnly: boolean; overlaps?: string }[];
  conflict: {
    hours: number;
    range: string;
    sources: { id: string; title: string; detail: string; reference: string }[];
    /** The two colliding commitments on one shared time scale, as CSS percentages. */
    lanes: {
      label: string;
      bars: { id: string; title: string; work: boolean; left: string; width: string }[];
      overlap: { left: string; width: string };
      ticks: { label: string; left: string; mark: boolean }[];
    };
  };
};

export function scheduleView(): ScheduleView {
  const [conflict] = currentConflicts();
  const events = listEvents();
  const clashing = events.filter(event => conflict.id.split(":").includes(event.id));
  const spans = clashing.map(event => ({ event, start: instant(event.start).epochMilliseconds, end: instant(event.end).epochMilliseconds }));
  const from = Math.min(...spans.map(span => span.start));
  const to = Math.max(...spans.map(span => span.end));
  const at = (value: number) => `${((value - from) / (to - from)) * 100}%`;
  const hour = (value: number) => formatTime(value).replace(":00", "");
  const sourceIds = [...conflict.sources, "swap", "availability"] as const;

  return {
    events: events.map(event => ({
      id: event.id, title: event.title, category: event.category, readOnly: Boolean(event.readOnly),
      time: [formatTime(event.start), formatTime(event.end)],
      overlaps: clashing.includes(event) ? clashing.find(other => other !== event)?.title : undefined,
    })),
    conflict: {
      hours: conflict.minutes / 60,
      range: `${formatTime(conflict.start)} – ${formatTime(conflict.end)}`,
      sources: sourceIds.map(id => ({ id, ...evidence[id] })),
      lanes: {
        label: `${spans.map(span => `${span.event.title}, ${formatTime(span.start)} to ${formatTime(span.end)}`).join("; ")}. They overlap from ${formatTime(conflict.start)} to ${formatTime(conflict.end)}.`,
        bars: spans.map(span => ({ id: span.event.id, title: span.event.title, work: span.event.category === "Work", left: at(span.start), width: at(from + span.end - span.start) })),
        overlap: { left: at(conflict.start), width: at(from + conflict.end - conflict.start) },
        ticks: [from, conflict.start, conflict.end, to].map((value, index) => ({ label: hour(value), left: at(value), mark: index === 1 || index === 2 })),
      },
    },
  };
}
