import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

/** The 1140px column, with 16px gutters on phones and 32px from md up. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={twMerge("mx-auto w-full max-w-[calc(1140px+4rem)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:pl-[max(2rem,env(safe-area-inset-left))] md:pr-[max(2rem,env(safe-area-inset-right))]", className)} {...props} />;
}
