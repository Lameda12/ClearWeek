import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { adjacentEvents, findConflicts, formatTime } from "@/lib/scenario";

export default function AdjacentExample() {
  const overlaps = findConflicts(adjacentEvents);

  return <main className="shell">
    <div className="intro">
      <div className="eyebrow">Synthetic example</div>
      <h1>Back-to-back commitments</h1>
      <p>Illustrative schedule · America/Halifax</p>
      <Link className="task-link" href="/"><ArrowLeft size={15} aria-hidden="true" /> Back to Chloe’s schedule</Link>
    </div>
    <section className="panel" aria-labelledby="adjacent-title">
      <div className="section-head"><div><h2 id="adjacent-title">{overlaps.length === 0 ? "No time overlap" : "Time overlap"}</h2>
        <p>The first commitment ends at 2 PM, when the second begins. Travel time is not evaluated.</p></div></div>
      <ol className="events">
        {adjacentEvents.map(event => <li className="event" key={event.id}>
          <div className="event-time">{formatTime(event.start)} <span>–</span> {formatTime(event.end)}</div>
          <h3>{event.title}</h3>
        </li>)}
      </ol>
    </section>
  </main>;
}
