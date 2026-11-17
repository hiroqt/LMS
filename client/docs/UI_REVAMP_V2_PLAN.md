# UI Revamp v2: one calm system for every role

Follows [`UI_REVAMP_PLAN.md`](UI_REVAMP_PLAN.md) (Student and Instructor rebuild, cut over
2026-11-17). v2 brings Admin onto the same system and removes decoration everywhere.
Decision record: D-037 in [`ui-memory/DECISIONS.md`](ui-memory/DECISIONS.md).

## Goals

Simple, modern, and easy to navigate on every role, without breaking a working journey.
Maintainable (one styling system, small files), secure (no new dependencies, no raw
HTML), fast (smaller CSS and fonts), and cross-platform (desktop, iPhone, Android,
Windows high contrast).

## The visual rules (C-019)

| Never | Instead |
|---|---|
| Gradients | Flat surfaces. Text over an image sits on a solid panel. |
| Eyebrows (small uppercase line above a heading) | The heading alone; a fact goes in the muted description under it. |
| Uppercase, letter-spaced labels | Sentence case at `text-body`. Course codes keep their capitals because the data is capitals. |
| Pulse, ping, bounce, keyframe entrances | Static skeletons that appear after 300 ms; 150 ms color and opacity transitions. The button spinner stays (functional, reduced-motion aware). |
| Status dots | An icon with text, or a tinted `Badge`. |
| Vertical side lines on cards or toasts | A uniform 1px border; tone is a soft tint and an icon. |
| `backdrop-blur` | A solid `bg-surface`. Blur is slow on low-end Android and older Safari. |
| Shadows on flat cards | A 1px `line` border. Only overlays (menus, dialogs, toasts) cast `shadow-popover`. |

Kept on purpose: `·` separators in metadata ("IT204 · Quiz"), round number badges in a
quiz and on results (they carry information), avatars and count pills.

`npm run style:check` (`scripts/style-guard.ts`) fails on any of the "Never" column in
`src/`.

## Page anatomy (every role)

1. Top bar: brand, search, notifications, profile.
2. Navigation: sidebar on desktop; Student bottom bar on phones, drawer for Instructor and
   Admin.
3. `PageHeader`: the single h1, a factual description, at most one primary action.
4. Sections: `SectionHeading` (title, count, description, action) with lists or cards.
5. Every list has loading (delayed skeleton), empty (`EmptyState`), and error (retry).

## Phases

| Phase | Scope | Proof |
|---|---|---|
| 0 | D-037, C-019, `style:check` script, this plan. Docs and tooling only. | `memory:check` |
| 1 | Shared primitives: `SectionHeading` without eyebrows, static `Skeleton`, flat toasts, border-only cards, solid top bar, flat carousel panel. | Unit + axe, all e2e |
| 2 | Student and Instructor pages: remove eyebrows and uppercase labels, reuse primitives for repeated markup. `style:check` joins CI for `app`, `shared`, `features`. | All e2e unchanged |
| 3 | Admin rebuilt in `features/admin` on `AppShell` and `shared/ui`, page by page. Flows from `ADMIN_USER_FLOW.md` unchanged. | Admin e2e unchanged |
| 4 | Delete `RoleWorkspace`, legacy CSS, and `components/shared`; turn preflight on; drop the `@source` limit and `!important` utilities (closes D-003, D-010, D-022). Drop the Poppins 700 file. `style:check` covers all of `src/`. | All e2e, budget |
| 5 | Verify: budget, Chromium/WebKit/Pixel e2e, forced colors, reduced motion, 200% zoom, 320 px sweep, screen-reader checklist with a person. | Reports in the PR |

## Guardrails on every PR

- `lint`, `typecheck`, `test:unit`, `test:e2e` (dev and `E2E_PREVIEW=1`), `build`,
  `budget`, `memory:check`, and from Phase 2 `style:check`.
- Specs change only with a DECISIONS entry (D-013).
- No new dependencies, no `dangerouslySetInnerHTML`, fonts stay self-hosted, no inline
  `style` except computed values (progress width).
- Storage keys `tmcc-lms-roles-v1` and `gclass-student-workspace-v1` keep their shape.
- The LMS API seam is untouched: this is a visual and structural change only.

## Out of scope

Dark mode, new journeys, backend changes.
