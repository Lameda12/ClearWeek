import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Colours come from the tokens in app/globals.css.
const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--r-control)] px-4 text-sm font-semibold transition-transform duration-[var(--quick)] active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
  { variants: { variant: {
    default: "bg-[var(--water-deep)] text-[var(--on-deep)] hover:bg-[var(--water)] disabled:bg-[var(--line)] disabled:text-[var(--muted)] disabled:opacity-100 aria-busy:disabled:bg-[var(--water-deep)] aria-busy:disabled:text-[var(--on-deep)] aria-busy:disabled:opacity-70",
    outline: "border border-[var(--line)] bg-[var(--surface)] text-[var(--water-deep)] hover:border-[var(--water)] hover:bg-[var(--water-wash)]",
    ghost: "text-[var(--water-deep)] hover:bg-[var(--water-wash)]",
  } }, defaultVariants: { variant: "default" } },
);

type Props = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & {
  asChild?: boolean;
  /** Shows a spinner and marks the button busy. The caller supplies the "doing…" label as children. */
  pending?: boolean;
};

export function Button({ className, variant, asChild, pending, children, ...props }: Props) {
  const Component = asChild ? Slot : "button";
  return <Component data-slot="button" type={asChild ? undefined : "button"} aria-busy={pending || undefined}
    className={twMerge(clsx(buttonVariants({ variant, className })))} {...props}>
    {pending && <span className="spinner" aria-hidden="true" />}{children}
  </Component>;
}
