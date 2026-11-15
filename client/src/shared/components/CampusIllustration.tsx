import { cn } from "../lib/cn";

/**
 * Decorative campus building for dashboard headers, drawn in the brand greens
 * so it works in any theme token change. Hidden from assistive technology.
 */
export function CampusIllustration({ className }: { className?: string }) {
  const windows = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      windows.push(<rect key={`${row}-${col}`} x={196 + col * 30} y={98 + row * 30} width="18" height="20" rx="2" className="fill-primary-200" />);
    }
  }
  return (
    <svg aria-hidden viewBox="0 0 520 240" className={cn("pointer-events-none select-none", className)} preserveAspectRatio="xMaxYMax meet">
      {/* rolling ground */}
      <path d="M0 240 C120 170 260 200 520 120 L520 240 Z" className="fill-primary-100" />
      <path d="M150 240 C260 205 380 215 520 170 L520 240 Z" className="fill-primary-200 opacity-70" />
      {/* main hall */}
      <rect x="180" y="74" width="196" height="132" rx="4" className="fill-surface stroke-primary-300" strokeWidth="2" />
      {windows}
      {/* entrance block with name band */}
      <rect x="240" y="40" width="76" height="40" rx="3" className="fill-surface stroke-primary-300" strokeWidth="2" />
      <text x="278" y="67" textAnchor="middle" fontSize="18" fontWeight="700" letterSpacing="2" className="fill-primary-700 font-sans">TMCC</text>
      <rect x="258" y="164" width="40" height="42" rx="2" className="fill-primary-300" />
      {/* side wing */}
      <rect x="376" y="104" width="86" height="102" rx="4" className="fill-surface stroke-primary-300" strokeWidth="2" />
      {[0, 1].map((row) => [0, 1].map((col) => <rect key={`w${row}${col}`} x={392 + col * 32} y={120 + row * 34} width="20" height="22" rx="2" className="fill-primary-200" />))}
      {/* trees */}
      <circle cx="150" cy="168" r="30" className="fill-primary-400" />
      <circle cx="128" cy="184" r="22" className="fill-primary-500" />
      <rect x="146" y="190" width="6" height="22" className="fill-primary-700" />
      <circle cx="484" cy="176" r="24" className="fill-primary-400" />
      <rect x="481" y="190" width="6" height="20" className="fill-primary-700" />
    </svg>
  );
}
