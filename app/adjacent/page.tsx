import Link from "next/link";
import { adjacentEvents, findConflicts, formatTime } from "@/lib/scenario";

export default function AdjacentExample() {
  const overlaps = findConflicts(adjacentEvents);

  return <main className="shell">
    <div className="intro">
      <div className="eyebrow">Synthetic example</div>
      <h1>Back-to-back commitments</h1>
      <p>Illustrative schedule · America/Halifax</p>
      <Link className="task-link" href="/">Back to Chloe’s schedule</Link>
    </div>
    <section className="panel" aria-labelledby="adjacent-title">
      <h2 id="adjacent-title">{overlaps.length === 0 ? "No time overlap" : "Time overlap"}</h2>
      <p>The first commitment ends at 2 PM, when the second begins.</p>
      <p>Travel time is not evaluated.</p>
      <ol className="events mt-4">
        {adjacentEvents.map(event => <li className="event" key={event.id}>
          <div className="event-time">{formatTime(event.start)} – {formatTime(event.end)}</div>
          <h3>{event.title}</h3>
        </li>)}
      </ol>
    </section>
  </main>;
}
