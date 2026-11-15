# UI memory

The shared, self-improving memory for the Student and Instructor UI revamp. It is
written for **everyone who changes the UI**, people and coding agents (Claude Code,
Codex, Cursor, …) alike. A personal agent's memory stays on one machine; this folder
travels with the repo, so every co-developer starts from the same knowledge.

The plan it serves is [`../UI_REVAMP_PLAN.md`](../UI_REVAMP_PLAN.md).

## Files

| File | What goes in it | Who writes it |
| --- | --- | --- |
| [`DECISIONS.md`](DECISIONS.md) | Choices that constrain future work, with the reason and the alternatives rejected. | Anyone, in the PR that makes the decision |
| [`CONVENTIONS.md`](CONVENTIONS.md) | Rules to follow when writing UI code. Short, imperative, testable. | Promoted from learnings (see the loop) |
| [`LEARNINGS.md`](LEARNINGS.md) | Things discovered while building: gotchas, bugs, surprises, known gaps. | Anyone, in the PR where it was learned |
| [`FLOW_PARITY.md`](FLOW_PARITY.md) | Migration status of every node in the Student and Instructor flow charts. | The PR that moves a screen |
| [`SCREEN_READER_CHECKLIST.md`](SCREEN_READER_CHECKLIST.md) | Manual VoiceOver / TalkBack / NVDA journeys that automation cannot judge. | A person, before cutover and after big changes |
| [`generated/`](generated/) | Component inventory, routes, and design tokens, generated from source. | `npm run memory:sync` only. CI fails when stale. |

## The loop

1. **Read before you build.** Before UI work, read `CONVENTIONS.md`, skim `DECISIONS.md`
   and `LEARNINGS.md`, and check `generated/components.md` for something to reuse.
2. **Capture as you go.** When a PR teaches you something, add an entry to `LEARNINGS.md`.
   When it makes a choice others must follow, add one to `DECISIONS.md`. The PR template
   asks for this, and CI warns when shared UI code changes without a memory update.
3. **Keep generated files true.** Run `npm run memory:sync` after changing `shared/`,
   `features/`, `app/router`, or tokens. `npm run memory:check` runs in CI.
4. **Consolidate every phase, or every 10 new learnings.** Follow
   [`.agents/skills/ui-memory/SKILL.md`](../../.agents/skills/ui-memory/SKILL.md):
   - Promote a learning that has applied twice (or that the next person would hit) into a
     rule in `CONVENTIONS.md`, and mark the learning `→ promoted to C-xx`.
   - When a decision changes, add a new decision that **supersedes** the old one. Never
     edit history silently.
   - Delete learnings that are fixed and no longer explain anything about the code.
5. **Trust, but check dates.** Every entry has a date and an author. If an entry names a
   file or function, confirm it still exists before relying on it.

## Entry format

```md
### L-012 · Short title
`2026-11-16` · author · scope: student/quiz · confidence: high | medium | low
What happened or what is true, in two to four sentences. Link the file, test, or PR.
Supersedes / promoted to: (optional)
```

IDs are sequential per file: `D-` decisions, `C-` conventions, `L-` learnings.
