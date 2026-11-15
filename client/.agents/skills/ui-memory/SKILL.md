---
name: ui-memory
description: Read, update, and consolidate the shared UI revamp memory in docs/ui-memory. Use before starting Student or Instructor UI work, after finishing a UI change, or when asked to consolidate or review the UI memory.
---

# UI memory

The shared memory for the Student and Instructor UI revamp lives in `docs/ui-memory/`.
Read `docs/ui-memory/README.md` for the full loop. This skill is the checklist.

## Before UI work

1. Read `docs/ui-memory/CONVENTIONS.md` in full.
2. Skim `DECISIONS.md` and `LEARNINGS.md` for entries whose scope matches the area.
3. Check `docs/ui-memory/generated/components.md` for an existing component to reuse.
4. Check `docs/ui-memory/FLOW_PARITY.md`. If a node you will touch has no spec (✖), write
   the spec against the current UI first and confirm it passes.

## After UI work, in the same PR

1. Add a `LEARNINGS.md` entry for anything surprising: a bug found, a gotcha, a known
   gap, a test that passed when it should not have.
2. Add a `DECISIONS.md` entry for any choice others must follow. Use a new entry that
   supersedes an old one; do not rewrite history.
3. Update `FLOW_PARITY.md` statuses for screens you moved.
4. Run `npm run memory:sync` and commit the generated files.
5. Fill in the "Memory" section of the PR description.

## Consolidating (each phase, or after 10 new learnings)

1. For each learning, ask: has it applied twice, or will the next person hit it? If so,
   write a short rule in `CONVENTIONS.md` and mark the learning `Promoted to C-xx`.
2. Delete learnings that describe something fixed, unless they still explain why the
   code looks the way it does.
3. Look for conventions that contradict a newer decision; supersede or remove them.
4. Check that every file, function, and test an entry names still exists. Fix or remove
   stale references.
5. Keep entries dated, attributed, and two to four sentences long.
6. Open the consolidation as its own small PR titled `docs(ui-memory): consolidate`.

Never put secrets, real student data, or personal details in the memory.
