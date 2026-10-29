---
name: admin-dashboard-design
description: Use when designing, implementing, or reviewing the Admin dashboard in this LMS prototype. Follow the supplied Ember reference's sidebar search, navigation, illustrated metric cards, and wide chart layout while preserving the LMS palette and admin data boundaries.
---

# Admin Dashboard Design

Use the user-provided Ember dashboard screenshot from 2026-10-29 as a structural reference. The linked X post may not be accessible; the screenshot and this pattern are sufficient.

## Pattern

1. Keep the existing shared `RoleWorkspace` shell, collapsible sidebar, mobile drawer, navigation groups, and role switching.
2. Place the existing Admin `GlobalSearch` below the brand in the sidebar. Search actual users, subjects, and classrooms; keep Instructor search in its top bar.
3. Start Overview with one large academic reporting heading and the active term or date scope.
4. Show four concise Admin metrics in aligned cards. Give each card a small inline SVG illustration that directly represents its metric (students, faculty, courses, or users); do not reuse one generic graphic across the cards. Keep labels, counts, and supporting notes sourced from current LMS data.
5. Put one wide primary activity chart directly below the metrics and scope controls. At desktop widths, keep System Activity, Student Activity, and student breakdown in one supporting row with equal card widths, aligned heights, and similarly sized chart areas. Stack them full-width on narrow screens while keeping their chart areas similarly sized.
6. Preserve create actions, date and term filters, chart tooltips, keyboard access, reduced-motion behavior, and responsive wrapping.

## Visual boundaries

- Copy the reference's hierarchy, sidebar placement, card composition, and chart prominence only.
- Keep Poppins, the warm white canvas, soft green surfaces, rounded cards, restrained LMS accents, and TMCC identity. Do not copy Ember branding, its dark palette, or financial graphics.
- Keep all values and events within the browser-local prototype. Label illustrative/sample values; never imply that the demo role matrix is enforced authorization or that recent activity is an audit log.
- Keep search, navigation, actions, and chart controls usable at narrow widths and with keyboard focus.

## When to Use

Use for Admin Overview layout work or when deciding where Admin dashboard search, metrics, or charts belong. Do not use it to redesign the Student dashboard or Instructor workspace.

## Limitations

This pattern describes layout and visual behavior. It does not add authentication, server persistence, real institutional analytics, or authorization.
