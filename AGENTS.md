<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — session entry point

This file is a navigation map, not a copy of the project documentation. Read the sources it points to.

## Read before changing anything

1. `CLAUDE.md` — long-term project rules, constraints, and frozen modules. Still authoritative.
2. `docs/refactor/MASTER_PLAN.md` — the refactor roadmap and its core principles.
3. `docs/refactor/PHASE_STATUS.md` — which phase is current, what is done, what is approved.
4. `docs/refactor/DECISIONS.md` — accepted architecture decisions (ADRs).
5. `docs/refactor/tasks/phase-<N>-task.md` — the task definition for the current phase.
6. `docs/refactor/handoffs/phase-<N-1>-handoff.md` — the previous phase handoff. Required before starting a new phase.
7. `docs/refactor/reviews/phase-<N>-review.md` — the current phase review, if one exists.
8. `docs/refactor/PHASE_EXECUTION_PROTOCOL.md` — cross-session Phase execution, review, recovery, closeout, and future-command reconstruction protocol.

## Hard rules

- Follow the phase boundaries in `MASTER_PLAN.md` and the current phase task exactly.
- Never advance to the next phase without external review and explicit user approval.
- No unrelated cleanup and no opportunistic refactoring. Out-of-scope changes are defects, not wins.
- `docs/refactor/` is the canonical cross-session project context. Keep it updated as those documents require.
- Git history and the current diff are the source of truth for what actually changed in code. Docs may lag; the diff does not.
- `CLAUDE.md` stays in place and stays authoritative. This file only routes you to it.
- Do not reconstruct future Phase work from chat memory or old command wording. Reconstruct it from canonical repository artifacts and Git, following `docs/refactor/PHASE_EXECUTION_PROTOCOL.md`.

## Note on executor history

Older task records, handoffs, audits, and reviews may name "Claude Code" as the execution agent. Those are historical records of who ran that phase at the time and are intentionally left unchanged.
