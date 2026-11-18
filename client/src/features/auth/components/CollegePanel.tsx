import { Globe } from "lucide-react";
import { cn } from "../../../shared/lib/cn";
import { collegeProfile, type CollegeStatement } from "../data/collegeProfile";
import { CollegeProfileDialog } from "./CollegeProfileDialog";
import { ProfileBillboard } from "./ProfileBillboard";
import { FacebookIcon } from "./SocialIcons";

const SOCIAL_ICONS = { facebook: FacebookIcon, website: Globe };

/**
 * The college half of the sign-in page (D-050, D-051): the right column of the desktop split,
 * below the form on phones. The college's name, then the rotating billboard of its vision,
 * mission, goal, and core values, which takes the panel's spare height; at the bottom the
 * "Institutional profile" button (every statement in full) and the "Connect with us" icon
 * links. A flat filled panel (D-027, C-019).
 */
export function CollegePanel({ statements = collegeProfile.statements, className }: { statements?: CollegeStatement[]; className?: string }) {
  return (
    <section
      aria-labelledby="college-name"
      className={cn("@container flex flex-col bg-primary-800 px-4 py-8 font-sans text-white sm:px-8 @4xl/page:px-10 @4xl/page:py-8 @7xl/page:px-14", className)}
    >
      <div className="flex w-full flex-1 flex-col gap-6">
        <div className="flex flex-1 flex-col gap-6">
          <h2 id="college-name" className="text-page-mobile leading-tight font-semibold tracking-tight @md:text-page">{collegeProfile.name}</h2>
          <ProfileBillboard statements={statements} />
        </div>

        <div className="flex flex-col gap-4">
          {statements.length > 0 && <CollegeProfileDialog statements={statements} />}

          <nav aria-label="Connect with us" className="flex items-center justify-between gap-4">
            <p className="text-body font-medium text-primary-200">Connect with us</p>
            <ul className="flex gap-2">
              {collegeProfile.links.map((link) => {
                const Icon = SOCIAL_ICONS[link.icon];
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`${link.label} (opens in a new tab)`}
                      title={link.label}
                      className="grid size-touch place-items-center rounded-control border border-primary-600 text-white transition-colors duration-150 hover:border-white hover:bg-primary-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      <Icon aria-hidden className="size-5" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </section>
  );
}
