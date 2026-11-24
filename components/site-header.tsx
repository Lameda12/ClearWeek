import Link from "next/link";
import { Container } from "@/components/ui/container";

// The ring is the water colour everywhere except here: water on water-deep is not visible.
const link = "inline-flex min-h-[var(--tap)] items-center text-[length:var(--text-small)] leading-5 font-semibold underline-offset-4 hover:underline focus-visible:outline-[var(--on-deep)]";

export function SiteHeader({ privateMode = false }: { privateMode?: boolean }) {
  return <>
    <a href="#schedule" className="sr-only focus:not-sr-only focus:flex focus:h-11 focus:items-center focus:justify-center focus:bg-[var(--surface)] focus:text-[length:var(--text-small)] focus:font-semibold focus:text-[var(--water-deep)] focus-visible:outline-offset-[-4px]">Skip to schedule</a>
    <header className="bg-[var(--water-deep)] text-[var(--on-deep)]">
      <Container className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" translate="no" className="inline-flex min-h-[var(--tap)] items-center text-[length:var(--text-h2)] leading-6 font-bold tracking-[-0.01em] font-stretch-[87.5%] focus-visible:outline-[var(--on-deep)]">ClearWeek</Link>
          <nav aria-label="Workspace" className="hidden items-center gap-8 md:flex">
            <a href="#schedule" className={link}>Schedule</a>
            <a href="#follow-up" className={link}>Follow-up</a>
          </nav>
        </div>
        <p className="text-[length:var(--text-small)] leading-5">{privateMode ? "Signed-in workspace" : "Sample data"}</p>
      </Container>
    </header>
  </>;
}
