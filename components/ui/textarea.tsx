"use client";

import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

/** One look for every text field: the Figma "Draft textarea" frame. */
export const fieldClass = "block w-full rounded-[var(--r-control)] border border-[var(--muted)] bg-[var(--surface)] p-3 text-[length:var(--text-body)] leading-6 text-[var(--ink)] placeholder:text-[var(--muted)] read-only:bg-[var(--ground)]";

type Props = ComponentProps<"textarea"> & {
  /** Grows with its content: min-h-36 and field-sizing, with a scrollHeight fallback where field-sizing is missing. */
  grow?: boolean;
};

export function Textarea({ grow, className, ref, value, ...props }: Props) {
  const own = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const element = own.current;
    if (!grow || !element || CSS.supports("field-sizing", "content")) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight + element.offsetHeight - element.clientHeight}px`;
  }, [grow, value]);
  return <textarea
    ref={node => { own.current = node; if (typeof ref === "function") ref(node); else if (ref) ref.current = node; }}
    value={value}
    className={twMerge(fieldClass, "min-h-24", grow && "min-h-36 max-h-[70vh] resize-none [field-sizing:content]", className)} {...props} />;
}
