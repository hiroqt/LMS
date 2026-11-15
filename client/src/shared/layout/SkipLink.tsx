/** First focusable element on every page: jumps keyboard users past the navigation. */
export function SkipLink({ target = "main-content" }: { target?: string }) {
  return (
    <a
      href={`#${target}`}
      className="sr-only z-[70] rounded-control bg-primary-700 px-4 py-3 font-sans text-body font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:outline-3 focus-visible:outline-focus"
    >
      Skip to main content
    </a>
  );
}
