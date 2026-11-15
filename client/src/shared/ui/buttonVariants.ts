import { cva } from "class-variance-authority";

/** Button classes, shared so links and other elements can look like buttons. */
export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-control border font-sans font-semibold",
    "select-none whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress",
  ],
  {
    variants: {
      variant: {
        primary: "border-transparent bg-primary-600 text-white hover:bg-primary-700",
        secondary: "border-line-strong bg-surface text-ink hover:bg-primary-50",
        ghost: "border-transparent bg-transparent text-ink hover:bg-primary-50",
        danger: "border-transparent bg-danger text-white hover:bg-danger-strong",
      },
      size: {
        md: "min-h-touch px-4 text-body",
        lg: "min-h-12 px-6 text-body-lg",
        icon: "size-touch p-0 text-body",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
