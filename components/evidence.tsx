import Image from "next/image";
import type { ScheduleView } from "@/lib/schedule-view";

type Source = NonNullable<ScheduleView["conflict"]>["sources"][number];

function Items({ sources }: { sources: Source[] }) {
  return <ul className="m-0 list-none p-0">
    {sources.map(source => <li key={source.id} className="flex flex-col gap-0.5 border-t border-[var(--line)] py-3">
      <p className="text-[length:var(--text-small)] leading-5 font-semibold text-[var(--ink)]">{source.title}</p>
      <p className="text-[length:var(--text-body)] leading-6 text-[var(--ink)]">{source.detail}</p>
      <p className="text-[length:var(--text-small)] leading-5 text-[var(--muted)]">{source.caption}</p>
    </li>)}
  </ul>;
}

/** Always open from md; a row that opens on a phone. The same list, once each, so only one is ever in the page. */
export function Evidence({ sources }: { sources: Source[] }) {
  return <>
    <details className="group border-t border-[var(--line)] md:hidden">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between text-[length:var(--text-small)] leading-5 font-semibold text-[var(--water)] underline-offset-4 hover:underline">
        Where this comes from
        <Image src="/v2/chevron-down.svg" alt="" width={20} height={20} unoptimized className="transition-transform duration-[var(--reveal)] group-open:rotate-180" />
      </summary>
      <Items sources={sources} />
    </details>
    <section aria-labelledby="evidence-title" className="hidden md:block">
      <h2 id="evidence-title" className="m-0 text-[length:var(--text-h2)] leading-6 font-bold tracking-[-0.01em] [text-wrap:wrap]">Where this comes from</h2>
      <Items sources={sources} />
    </section>
  </>;
}
