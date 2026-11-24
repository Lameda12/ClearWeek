const block = "rounded-md bg-[var(--line)]";
// Offsets follow the Figma loading frames (phone, then md). Whole class names, so Tailwind can see them.
const rows = [
  { label: "top-[38px] md:top-[46px]", bar: "top-[56px] left-[35.8px] md:top-[52px] md:left-[323px]" },
  { label: "top-[102px] md:top-[102px]", bar: "top-[120px] left-[100.24px] md:top-[108px] md:left-[486px]" },
  { label: "top-[166px] md:top-[158px]", bar: "top-[184px] left-[164.68px] md:top-[164px] md:left-[650px]" },
  { label: "top-[230px] md:top-[214px]", bar: "top-[248px] left-[229.12px] md:top-[220px] md:left-[813px]" },
];

/** What the page shows while the saved workspace loads: the conflict statement, the ruler and the two lists, as grey blocks. */
export function LoadingSkeleton() {
  // The id and tabIndex match the day ruler, so "Skip to schedule" has a target in every state.
  return <div id="schedule" tabIndex={-1} role="status" aria-busy="true" className="flex scroll-mt-4 flex-col gap-6 md:gap-10">
    <p className="sr-only">Loading the saved workspace…</p>
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className={`${block} h-11 w-[280px] md:w-[420px]`} />
      <div className={`${block} h-4 w-full`} />
    </div>
    <div className="relative h-80 md:h-[300px]" aria-hidden="true">
      {rows.map(row => <div key={row.label}>
        <div className={`${block} absolute left-0 h-3.5 w-[200px] md:w-[220px] ${row.label}`} />
        <div className={`${block} absolute h-6 w-[125.3px] md:w-[318px] ${row.bar}`} />
      </div>)}
    </div>
    <div className="grid gap-4 md:grid-cols-2 md:gap-x-12" aria-hidden="true">
      {["Follow-up tasks", "Action history"].map(title => <div key={title} className="flex flex-col gap-2 border-t border-[var(--line)] pt-4">
        <p className="text-[length:var(--text-h2)] leading-6 font-bold tracking-[-0.01em] font-stretch-[87.5%]">{title}</p>
        <div className={`${block} h-4 w-full`} />
      </div>)}
    </div>
  </div>;
}
