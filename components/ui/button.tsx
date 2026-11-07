import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 disabled:pointer-events-none disabled:opacity-45",
  { variants: { variant: {
    default: "bg-[#153f4b] text-white hover:bg-[#245a67]",
    outline: "border border-[#c7d5d7] bg-white text-[#153f4b] hover:bg-[#eff5f5]",
    ghost: "text-[#315663] hover:bg-[#e9f1f2]",
  } }, defaultVariants: { variant: "default" } },
);

export function Button({ className, variant, asChild, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component data-slot="button" className={twMerge(clsx(buttonVariants({ variant, className })))} {...props} />;
}
