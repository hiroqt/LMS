import { ArrowLeft } from "lucide-react";

export function BackLink({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex min-h-touch items-center gap-2 self-start rounded-control border-0 bg-transparent px-2 -ml-2 font-sans text-body font-medium text-primary-700 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {label}
    </button>
  );
}
