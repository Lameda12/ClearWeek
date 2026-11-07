import { Temporal } from "@js-temporal/polyfill";

export const date = "2026-10-23";
export const zone = "America/Halifax";
export const evidence = {
  bus: { title: "Team calendar", reference: "image17.png · Calendar widget", detail: "Team bus to Saint John, 2–6 PM." },
  shift: { title: "Work calendar", reference: "image10.png · Event details", detail: "Harbour Foods, 4–10 PM. The subscribed calendar says the shift cannot be edited there." },
  swap: { title: "Shift swap notification", reference: "image2.png · Notifications", detail: "The October 23 swap was declined. The notification says Chloe is still scheduled." },
  availability: { title: "Work reminder", reference: "image4.png / image5.png · Reminders", detail: "Updating availability with the meet schedule was overdue. The Work list identifies Dana as store manager." },
  morning: { title: "Morning schedule", reference: "image17.png · Calendar widget", detail: "Swim practice 5:30–7 AM and NURS 2050 Health Assessment 8:35–9:55 AM." },
} as const;
type EvidenceId = keyof typeof evidence;

export type Event = {
  id: string; title: string; start: string; end: string;
  category: "Swim" | "School" | "Work"; source: EvidenceId; readOnly?: boolean;
};

export const events: readonly Event[] = [
  { id: "practice", title: "Swim practice (taper)", start: `${date}T05:30`, end: `${date}T07:00`, category: "Swim", source: "morning" },
  { id: "class", title: "NURS 2050 Health Assessment", start: `${date}T08:35`, end: `${date}T09:55`, category: "School", source: "morning" },
  { id: "bus", title: "Team bus to Saint John", start: `${date}T14:00`, end: `${date}T18:00`, category: "Swim", source: "bus" },
  { id: "shift", title: "Harbour Foods shift", start: `${date}T16:00`, end: `${date}T22:00`, category: "Work", source: "shift", readOnly: true },
];

export function instant(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("A complete local date and time is required.");
  return Temporal.PlainDateTime.from(value).toZonedDateTime(zone, { disambiguation: "reject" }).toInstant();
}

export function findConflicts(schedule: readonly Event[]) {
  const intervals = schedule.map(event => {
    const start = instant(event.start).epochMilliseconds;
    const end = instant(event.end).epochMilliseconds;
    if (end <= start) throw new Error("An event must end after it starts.");
    return { event, start, end };
  });
  return intervals.flatMap((a, index) => intervals.slice(index + 1).flatMap(b => {
    const start = Math.max(a.start, b.start);
    const end = Math.min(a.end, b.end);
    return start < end ? [{ id: [a.event.id, b.event.id].sort().join(":"), start, end, minutes: (end - start) / 60_000, sources: [a.event.source, b.event.source] }] : [];
  }));
}

const clock = new Intl.DateTimeFormat("en-CA", { timeZone: zone, hour: "numeric", minute: "2-digit", hour12: true });
export const formatTime = (value: string | number) => clock.format(typeof value === "string" ? instant(value).epochMilliseconds : value).toUpperCase();
export const list_events = () => events;
export const find_conflicts = () => findConflicts(list_events());
