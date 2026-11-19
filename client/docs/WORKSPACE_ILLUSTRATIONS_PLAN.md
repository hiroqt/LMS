# Student and Instructor empty-state illustrations

Add a small, static unDraw illustration to three existing empty states, starting with the Student screens. Use the current TMCC green, Poppins typography, flat surfaces, and spacing. See the [asset shortlist](WORKSPACE_ILLUSTRATION_ASSETS.md).

**Scope.** Student My Classes, Student classroom Materials, and Instructor classroom Materials. The dashboard, Admin, assessment-taking screens, search results, and loading and error states are outside this pass. Keep existing messages, controls, routes, and data behavior.

## Implementation checklist

- [x] Confirm the three placements as a narrow exception to the [no-illustration convention](ui-memory/CONVENTIONS.md#c-016--preferences-and-plain-copy) before editing the UI.
- [x] Bundle only the three selected SVGs as local assets, using TMCC `primary-600` (`#32806d`) for the artwork accent.
- [x] Reuse the existing `EmptyState` pattern. Size the SVG proportionally, cap it at about 88 px on wider screens, and keep a compact treatment at 320 px. Use empty alt text because the existing message carries the meaning.
- [x] Add **Open Book** to Student My Classes when there are no active enrollments.
- [x] Add **Reading** to the Student classroom Materials tab when the class has no materials before search. Keep the shared material grid and its existing no-match message for searches.
- [x] Add **Folder files** to Instructor classroom Materials when the existing state says “No materials yet.” Keep **Add material** wired to the same form and keep the current icon for filter misses.
- [x] Verify the empty, populated, and filtered states on desktop and at 320 px. Check that the Instructor action still opens the material form and that assistive technology reads only the existing message and controls.
- [x] Run lint, typecheck, `style:check`, the existing Student and Instructor material flows, and the production build and budget. Record the approved exception and checks in the project’s [UI memory](ui-memory/README.md).
