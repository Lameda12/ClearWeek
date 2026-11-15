import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return <main className="shell">
    <div className="intro">
      <h1>This page is not part of ClearWeek</h1>
      <p>The address may be mistyped. Chloe’s Friday schedule is the place to start.</p>
      <Link className="task-link" href="/">Go to Chloe’s schedule <ArrowRight size={15} aria-hidden="true" /></Link>
    </div>
  </main>;
}
