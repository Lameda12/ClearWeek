import { Temporal } from "@js-temporal/polyfill";
import { currentConflicts, evidence, formatTime, instant, listEvents, zone } from "./scenario";

/**
 * Everything the workspace screen shows about the day, already formatted.
 * Built on the server so the browser never downloads the Temporal polyfill.
 */
export type ScheduleView = {
  /** The day ruler: every commitment on one shared time scale, as CSS percentages of the ruler width. */
  day: {
    lanes: { id: string; title: string; category: string; time: [start: string, end: string]; readOnly: boolean; left: string; width: string; overlaps: boolean }[];
    ticks: { label: string; left: string }[];
    /** Plain-text version of the whole chart, for people who cannot see it. */
    summary: string;
  };
  /** `null` when no two commitments overlap. */
  conflict: null | {
    hours: number;
    /** "4:00 PM" and "6:00 PM". */
    start: string;
    end: string;
    titles: [first: string, second: string];
    /** The overlap as a ruler label, such as "Overlap 4 to 6 PM". */
    label: string;
    band: { left: string; width: string; center: string };
    sources: { id: string; title: string; detail: string; caption: string }[];
  };
};

// The ruler runs from 5 AM to 10 PM: 17 hours, so one hour is 100 / 17 percent.
const dayStart = 5;
const dayEnd = 22;
const percent = (minutes: number) => `${((minutes - dayStart * 60) / ((dayEnd - dayStart) * 60)) * 100}%`;
const minuteOfDay = (value: number | string) => {
  const at = (typeof value === "string" ? instant(value) : Temporal.Instant.fromEpochMilliseconds(value)).toZonedDateTimeISO(zone);
  return at.hour * 60 + at.minute;
};
const hourLabel = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;

/** "4 to 6 PM" when both ends share AM or PM and fall on the hour, otherwise the full times. */
function spoken(start: number, end: number) {
  const whole = (value: number) => value % 60 === 0;
  const meridiem = (value: number) => (value / 60 < 12 ? "AM" : "PM");
  const clock = (value: number) => `${Math.floor(value / 60) % 12 || 12}${whole(value) ? "" : `:${String(value % 60).padStart(2, "0")}`}`;
  if (whole(start) && whole(end) && meridiem(start) === meridiem(end)) return `${clock(start)} to ${clock(end)} ${meridiem(end)}`;
  return `${clock(start)} ${meridiem(start)} to ${clock(end)} ${meridiem(end)}`;
}

export function scheduleView(): ScheduleView {
  const [conflict] = currentConflicts();
  const events = listEvents();
  const clashing = conflict ? events.filter(event => conflict.id.split(":").includes(event.id)) : [];

  const lanes = events.map(event => {
    const start = minuteOfDay(event.start);
    const end = minuteOfDay(event.end);
    return {
      id: event.id, title: event.title, category: event.category, readOnly: Boolean(event.readOnly),
      time: [formatTime(event.start), formatTime(event.end)] as [string, string],
      left: percent(start), width: `${((end - start) / ((dayEnd - dayStart) * 60)) * 100}%`,
      overlaps: clashing.includes(event),
    };
  });
  const ticks = [6, 9, 12, 15, 18, 21].map(hour => ({ label: hourLabel(hour), left: percent(hour * 60) }));

  const overlapStart = conflict ? minuteOfDay(conflict.start) : 0;
  const overlapEnd = conflict ? minuteOfDay(conflict.end) : 0;
  const span = conflict ? spoken(overlapStart, overlapEnd) : "";
  const listing = lanes.map(lane => `${lane.title}, ${lane.time[0]} to ${lane.time[1]}`).join(". ");
  const summary = `Day schedule from ${hourLabel(dayStart)} to ${hourLabel(dayEnd)}. ${listing}. ` +
    (conflict ? `${clashing.map(event => event.title).join(" and ")} overlap from ${span}.` : "No commitments overlap.");

  if (!conflict) return { day: { lanes, ticks, summary }, conflict: null };
  const sourceIds = ["swap", ...conflict.sources, "availability"] as const;
  return {
    day: { lanes, ticks, summary },
    conflict: {
      hours: conflict.minutes / 60,
      start: formatTime(conflict.start), end: formatTime(conflict.end),
      titles: [clashing[0].title, clashing[1].title],
      label: `Overlap ${span}`,
      band: {
        left: percent(overlapStart), width: `${((overlapEnd - overlapStart) / ((dayEnd - dayStart) * 60)) * 100}%`,
        center: percent((overlapStart + overlapEnd) / 2),
      },
      // The notes already name the document; the screen shows only the part after the last "·".
      sources: sourceIds.map(id => ({ id, title: evidence[id].title, detail: evidence[id].detail, caption: evidence[id].reference.split(" · ").pop() ?? "" })),
    },
  };
}
