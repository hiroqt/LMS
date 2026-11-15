# Student and Instructor UI revamp plan

`Agreed 2026-11-16`. Decisions are recorded in [`ui-memory/DECISIONS.md`](ui-memory/DECISIONS.md),
and progress per flow node in [`ui-memory/FLOW_PARITY.md`](ui-memory/FLOW_PARITY.md).

## Goal

Rebuild the Student and Instructor UIs with a modern React structure, Tailwind, and a token
design system. The result is responsive on phones, tablets, and desktops, resilient on slow or
dropped connections, and accessible to students and instructors moving from the old UI. **Every
user flow stays exactly the same**, proven by automated tests.

## Scope decisions

| Question | Decision |
| --- | --- |
| Admin | Out of scope. Stays on its current shell and CSS; smoke-tested so it cannot break. |
| Language | TypeScript, file by file (`allowJs`, strict). Compatible with the ASP.NET Core backend through OpenAPI-generated types later. |
| Type scale | 14px minimum body text; muted text darkened for WCAG AA. |
| Backend | Later. Frontend first on browser storage, behind hooks that can swap to the .NET API. |

## Principles

1. **The flows are a contract.** `STUDENT_USER_FLOW.md` and `INSTRUCTOR_USER_FLOW.md` are encoded
   as Playwright specs against the old UI. Rebuilt screens pass the same specs unchanged.
2. **Same words, new look.** Navigation labels and tab names stay (Today, Tasks, My classes,
   Stream / Classwork / Materials / People, Submissions, Gradebook), so users keep their habits.
3. **Data is compatible.** Storage keys and shapes stay until the API replaces them.
4. **Admin is untouched.**

## Stack

| Concern | Choice |
| --- | --- |
| Styling | Tailwind CSS v4 with `@theme` tokens; `clsx` + `tailwind-merge` + `cva` for variants (Phase 1) |
| Accessible primitives | Radix UI, set up shadcn-style so the code lives in the repo (Phase 1) |
| Routing | React Router (v8) |
| Data | TanStack Query (offline-first defaults) over a local adapter, later the .NET API |
| Forms | react-hook-form + zod (Phase 3) |
| Icons | lucide-react, replacing `icons.jsx` (Phase 1) |
| Font | Poppins, self-hosted with `@fontsource/poppins` |
| Tests | Vitest + Testing Library; Playwright (desktop Chromium, iPhone WebKit, Pixel Chromium); axe |

## Folder structure

```
client/src/
├─ app/            providers/, router/, layouts/
├─ features/
│  ├─ student/     today, news, calendar, tasks, classes, assessment, materials
│  └─ instructor/  overview, news, classes, classwork, announcements, content,
│                  submissions, gradebook, create-class
│     each feature: components/ hooks/ api/ types.ts index.ts
├─ shared/
│  ├─ ui/          Button, Card, Input, Select, Dialog, Tabs, Badge, Skeleton, EmptyState, Toast
│  ├─ layout/      AppShell, Sidebar, Topbar, MobileBottomNav, PageHeader
│  ├─ components/  Avatar, Breadcrumbs, GlobalSearch, NotificationMenu, RoleSwitcher
│  ├─ hooks/       useNetworkStatus, useMediaQuery, useDebounce, useCountdown
│  ├─ lib/         cn(), dates, formatting, storage (same keys)
│  ├─ api/         adapters (local now, http later), types
│  └─ styles/      tailwind.css, fonts.css
e2e/               flow-parity specs
```

`features` import `shared`; `shared` never imports `features`.

## Design system

- **Tokens** (`src/shared/styles/tailwind.css`): the TMCC green as `primary-50…900` (600 and 700 are
  the original colors), gold accent, AA-safe neutrals and status colors, card/control radius,
  shadows, and 44px touch spacing.
- **Type**: page 28px (24px on phones), section 18px, card title 15px, body ≥14px, eyebrow label 12px;
  inputs 16px.
- **Contrast**: muted `#5f6b67`; green text uses `primary-700`. Enforced by `tokens.test.ts`.
- **Components**: variants plus loading, disabled, error, and empty states; ≥44px targets.

## Responsive and cross-platform

- Mobile-first breakpoints `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Every screen works at 320px wide
  and at 200% zoom with no sideways page scroll.
- Student on phones: bottom navigation (Today, Tasks, Classes, Calendar); desktop sidebar.
  Instructor: drawer on phones, collapsible sidebar on larger screens. Tables become card lists
  below `md`.
- Quiz on phones: sticky question navigator and timer, large answer targets, Submit away from Next.
- `dvh` units, safe-area insets, `prefers-reduced-motion`, `forced-colors`, hover only on hover
  devices.
- Verified on iOS Safari, Android Chrome, and desktop Chrome/Edge/Firefox/Safari, with VoiceOver,
  NVDA, and TalkBack passes in Phase 4.

## Slow or lost connection

| Layer | Plan |
| --- | --- |
| Detection | `useNetworkStatus` (online/offline plus slow-request timing) with a polite banner |
| Loading | Content-shaped skeletons; "Still loading…" after 3s; timeout with Retry after 15s |
| Data | QueryClient: offline-first, 30s stale time, retries with capped backoff, cache persisted to IndexedDB (Phase 4) |
| Quiz | Answers save locally per answer; submissions go through an outbox with idempotency keys; time left derives from an absolute deadline; offline state "Submitted on this device, sending when you're back online" |
| Instructor writes | Optimistic grade and announcement saves with a "Pending sync" badge and rollback |
| Weight | Route-level code splitting; initial JS under about 170 KB gzipped; AVIF/WebP banners, lazy-loaded |
| PWA | `vite-plugin-pwa` offline shell and install prompt (Phase 4) |

## Accessibility and adoption

Target WCAG 2.2 AA: skip link, landmarks, one `h1` per page with focus moved on navigation,
`aria-live` for save, sync, and timer milestones (30s, 10s, 0), full keyboard support (1–4 to pick
answers), labelled forms with an error summary. An instructor-controlled time extension satisfies
WCAG 2.2.1 without changing the default 60s timer. To help people adjust: a one-time "What's new"
tour per role (replayable), a text-size/density setting, clear empty states, consistent placement
of primary actions, and a temporary "Use classic view" toggle until cutover.

## Backend seam (for later)

Feature hooks read and write through `shared/api` adapters: `localAdapter` today, `httpAdapter` for
ASP.NET Core later, selected by `VITE_DATA_SOURCE`. Contract to agree when wiring: OpenAPI with
generated TypeScript types; `ProblemDetails` errors mapped to form fields; UTC ISO dates; shared
pagination; `ETag`/`If-Match` on grades and settings; `Idempotency-Key` on submissions; cookie auth
with antiforgery; roles enforced server-side.

## Phases

Each phase ships as one PR with several focused commits, a per-file self-review, and a merge to
`main` once the review matches this plan.

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| **0. Foundations** | `.gitignore`; TypeScript; React Router; app providers; Tailwind without preflight; tokens; Poppins; Vitest and Playwright; flow-parity specs on the current UI; shared memory; CI | Lint, typecheck, unit, e2e, build, and memory check pass on the current UI |
| **1. Design system and shell** | `shared/ui` primitives on Radix, lucide icons, AppShell (Student bottom nav, Instructor drawer), network banner, toasts, skeletons, classic/new toggle; fill ✖ specs for shell nodes | Primitives pass axe in component tests; shell works at 320px; parity specs green |
| **2. Student** | Today/News → Tasks → Calendar → Class tabs → Material → Assessment detail → Quiz/Result (extract `useQuizSession` first) | Student parity specs pass on the new UI; axe clean on rebuilt screens |
| **3. Instructor** | Overview/News → Classes, Stream, Classwork, People → Announcements → Create class and content → Submissions and grading → Gradebook | Instructor parity specs pass, including the round trip to Student |
| **4. Hardening** | Outbox, persisted cache, PWA, screen-reader passes, throttled-network e2e, performance budget | WCAG 2.2 AA checklist; Lighthouse ≥90 for performance and accessibility on mobile |
| **5. Cutover** | Remove the classic toggle and legacy Student/Instructor code and CSS (Admin's stays); turn on preflight; update flow docs | No legacy Student/Instructor CSS imported; docs match the app |

**Definition of done, per screen**: parity specs pass unchanged; axe clean; works at 320 / 768 /
1280; keyboard-only works; skeleton and error states; degrades clearly offline; memory updated.

## Risks

- **Quiz timer and submission** are the riskiest logic. Extract a tested `useQuizSession` before any
  quiz UI.
- **Legacy and new CSS side by side.** Mitigated by no preflight and restricted Tailwind scanning
  (pixel-identical screenshots verified in Phase 0).
- **Contributor drift.** Mitigated by the memory loop, generated inventories, and CI checks.
- **Known flow gap**: exam feedback has no Student entry point after the result screen (L-003).
  Decide in Phase 2.
