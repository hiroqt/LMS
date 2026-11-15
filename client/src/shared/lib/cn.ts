import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom type-scale tokens so `text-body` and
// `text-primary-700` are not treated as conflicting (one is a size, one a color).
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["label", "body", "body-lg", "card-title", "section", "page", "page-mobile"] }],
    },
  },
});

/** Joins class names and resolves Tailwind conflicts (last one wins). */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
