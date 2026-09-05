# AI Agent Work Instructions

## Document Roles

```text
The Master Project Registry is the authoritative project-state document:
docs/modernization/MASTER_PROJECT_REGISTRY.md

This document defines the workflow and behavioral rules for AI agents.

The Registry records project facts and status.
This document records agent procedures.
```

---

## A. Start-of-Task Procedure

1. Read `MASTER_PROJECT_REGISTRY.md` (the factual source of truth).
2. Inspect current repository state (`git status`, `git log -1`).
3. Inspect the relevant implementation for the task at hand.
4. Verify the registry's assumptions against actual code/schema/Git.
5. Reconcile recent Git changes not yet reflected in the registry.

## B. Task Selection

- Choose exactly **ONE** implementation item.
- Prefer the highest-value small, independently completable item.
- Prefer items from the registry's **Current Next Item** or prioritized backlog.
- Do not automatically fix everything discovered during inspection.

## C. Scope Control

- **One task = one complete improvement.**
- Do not silently expand scope.
- Do not bundle unrelated fixes into one task.
- If the selected item is already complete: verify, update the registry, choose the next correct item, STOP.

## D. Implementation Procedure

```text
Inspect
→ Define acceptance criteria
→ Implement
→ Test
→ Manually verify
→ Review
```

## E. Safety Rules

- **No fabricated data** — never invent records, metrics, or test results.
- **No fabricated GIS** — never invent coordinates or boundaries.
- **No security weakening** — never relax authorization or isolation for convenience.
- **No unnecessary architecture changes** — preserve the approved stack unless explicitly approved.
- **No secret commits** — never commit secrets or temporary artifacts.
- **No accidental legacy deletion** — the legacy frontend was deliberately decommissioned (commit `43d101d`); do not reintroduce it, and do not delete unrelated legacy content accidentally.
- **No production changes without authorization** — do not deploy or modify production infrastructure unless explicitly authorized.

## F. Technology Restrictions

- **No TanStack Query** unless explicitly re-approved.
- **PostgreSQL + PostGIS preservation** — do not replace the database foundation.
- **No continuous GPS tracking** unless explicitly activated.
- **No route optimization** unless explicitly activated.
- **No Android/Play Store publishing** unless explicitly activated.

## G. Testing Procedure

Require appropriate validation for the change:

```text
Frontend:  npx vitest run        (from frontend-next/)
Backend:   npm test              (from backend/, NODE_ENV=test)
Lint:      next lint             (frontend-next/)
Typecheck: tsc --noEmit          (frontend-next/)
Build:     next build            (frontend-next/)
```

Plus relevant targeted validation for the module touched.

- Do not require every command when it is irrelevant or unavailable.
- Report blocked checks honestly (e.g., missing JAVA_HOME for Android builds is an environment blocker, not a pass).
- Record the exact command, result, date, and commit in the registry testing baseline.

## H. Manual Verification

Verify — relevant to the changed item — that the change actually works:

- Functional behavior (real interaction, not just tests).
- Responsive behavior (mobile-first).
- Accessibility (keyboard, labels, contrast).
- Authorization (role/kebele/zone scoping) when applicable.

## I. Documentation Procedure

After implementation:

- Update relevant documentation (module docs, contracts) if changed.
- Update the Master Project Registry:
  - Current status
  - Completed work / incremental improvement history
  - Module status
  - Priorities / backlog
  - Current Next Item
  - Testing baseline
  - Known limitations / placeholders
  - Open questions
- Record the commit, tests, and limitations with evidence.

## J. Git Procedure

```text
git status
git diff        (review all changes)
commit          (single, focused, descriptive message per task)
verify clean tree
```

- No secrets or temporary artifacts in commits.
- Only committed changes relevant to the task.

## K. End-of-Task Procedure

```text
Update registry
→ Record completed work
→ Update backlog
→ Select next candidate (in the registry only)
→ Commit
→ Report
→ STOP
```

- Do **not** implement the next candidate in the same task.

## L. Blocked Work Procedure

If blocked (external dependency, missing credential, missing data):

```text
Record blocker
→ Identify owner
→ Identify exact dependency
→ Do not fabricate a workaround
→ Do not mark complete
→ STOP
```

List blockers in the registry's External Blockers section.

## M. Conflict Resolution

When registry, documentation, and implementation disagree:

```text
Inspect the actual implementation
→ inspect database/schema
→ inspect Git history
→ identify the contradiction
→ record the uncertainty
→ do not silently overwrite facts
```

If needed, add an Open Question in the registry.

## N. Completion Standard

An item is complete **only** when:

- Implementation works.
- Required tests pass.
- Manual verification is complete.
- Authorization is correct.
- No fake data exists.
- Documentation is updated.
- Commit exists.
- Registry is updated.

---

## Operating Diamond

```text
MASTER_PROJECT_REGISTRY.md
        │
        │ WHAT / CURRENT STATE
        ▼
Project facts, requirements,
decisions, history, backlog,
limitations, blockers
        ▲
        │
AGENT_WORK_INSTRUCTIONS.md
        │
        │ HOW
        ▼
Inspect → Select one → Implement
→ Test → Verify → Update Registry
→ Commit → Stop
```

One task = one complete improvement. Inspect → Implement → Test → Verify → Commit → Update Registry → STOP.