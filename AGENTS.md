# AGENTS.md

## Purpose

This file is the operational guide for AI coding agents working in this repository.

Keep the working context minimal. Do not read large parts of the repository unless the task requires it. Prefer local discovery over global exploration.

For project-specific context (what this app does, hard rules, current state), see `CLAUDE.md` — read it first, always.

---

## Stack

- Framework: React 19 + Vite
- Language: TypeScript (strict)
- UI: Material UI 9 (Emotion) — no Tailwind, no shadcn/ui
- Routing: React Router 7
- Data fetching: TanStack Query v5
- Forms: React Hook Form + Zod
- Tests: Vitest + Testing Library
- Package manager: npm

---

## Repository Structure

Feature-first, the same principle used by the backend v3 projects.

```text
src/
├── app/                 # Composition: App, router, navigation (menu by role), layout wiring
├── core/                # Genuinely shared infrastructure
│   ├── api/             # HTTP client, envelope parsing, ApiError, generated types
│   ├── session/         # Tokens, refresh, roles, route guards
│   ├── realtime/        # WebSocket (ticket, reconnection)
│   └── ui/
│       ├── theme/       # Brand tokens, MUI theme, color scheme
│       ├── layout/      # AppShell, Sidebar, TopBar, PageHeader, PageContainer
│       └── components/  # Shared building blocks (StatusChip, ConfirmDialog, ...)
├── features/            # One folder per business feature
│   └── <feature>/       # <Feature>Page.tsx, components/, <feature>Api.ts, <feature>Queries.ts
└── test/                # Test setup
```

Folders are created when their first file exists — do not scaffold empty features.

---

## Context Strategy

For every task:

1. Read `CLAUDE.md`.
2. Identify the feature involved and inspect `src/features/<feature>/`.
3. Read the contract only for the endpoints the task touches (`../API/src/v3/APP-GUIDE.md`, then `../API/src/v3/openapi.json`).
4. Inspect `core/` or other features only when a dependency requires it.
5. Use repository-wide search only when local discovery is insufficient.

`../FRONT/` (the current panel) is a behavior reference only. Never edit it and do not port its code line by line.

---

## Core Architecture Rules

### Feature Locality

Feature-specific code stays in `features/<name>/`. Move code to `core/` only when two or more features genuinely use it.

### Componentization

Pages orchestrate; they do not hold the whole screen. Split a page into components inside the feature's `components/` by responsibility (a card, a dialog, a table), not by line count. A component moves to `core/ui/components/` only when a second feature needs it.

### Boundaries

- Dependency direction: `app → features → core`. `core` never imports from `features` or `app`; features do not import from each other's internals.
- UI does not know HTTP details: pages use query hooks, hooks use the feature's `*Api.ts`.
- Only `core/api` knows the response envelope and HTTP status codes; features receive typed data or an `ApiError`.
- Only `core/session` reads or writes tokens.
- The app talks only to same-origin `/v3/api` and `/v3/ws`. Never call an absolute API URL, never call `/v2`.

### Progressive Complexity

Start with the simplest structure that correctly represents the feature. Do not add layers, mappers, wrappers or dependencies preemptively.

---

## UI Rules

- Colors, typography and component defaults live in `core/ui/theme/`. No raw hex colors or font stacks in components.
- Use MUI components and the `sx` prop; do not add another styling system.
- User-facing text is Brazilian Portuguese, correctly accented.
- Commands that act on physical equipment: disable the control while in flight, never retry automatically, honor `Retry-After`, and confirm destructive ones in a dialog.

---

## Error Handling

- Never silently swallow errors.
- Map backend errors to UI states by `error.type`, never by parsing `detail`.
- Never show stack traces, tokens or internal identifiers to the user.

---

## Security

- Never hardcode credentials or tokens. Everything prefixed `VITE_` ships in the bundle — never a secret.
- Never log tokens, passwords or temporary passwords.
- Staff-only data (CPF, phone, photos, TAG cache) stays in memory: no `localStorage`, no logs.
- Treat everything from the server as untrusted input for rendering.

---

## Naming

Predictable, domain-specific names: `GatesPage`, `exhaustApi`, `sessionStore`. Avoid `Manager`, `Helper`, `Utils`, `Common` when a specific name is possible. Domain vocabulary follows the workspace root `AGENTS.md` (unidade, prumada, vínculo, CIE...).

---

## Scope Discipline

Keep changes focused on the requested task. No unrelated refactoring, no new libraries without necessity, no architecture change as a side effect of a small feature.

---

## Comments

Comments explain **why**, not **what**.

---

## Validation

Before considering a change complete:

```bash
npm run lint
npm test
npm run build
```

Test behavior, not implementation details. Never point automated tests at the real API — use a fake `fetch` with responses shaped like the v3 envelope.

If a validation step cannot be run, state explicitly which one was skipped.

---

## Before Completing a Task

Verify:

- the requested behavior is implemented;
- changes stay within the right feature boundaries;
- nothing in `../FRONT/` or in any backend was touched;
- lint, tests and build pass;
- `CHANGELOG.md` (`[Unreleased]`) was updated;
- `CLAUDE.md` was updated if the project state or a hard rule changed.

---

## Primary Principle

When choosing between two implementations, prefer the one that lets a future developer or agent understand and modify the feature while loading the least amount of unrelated context.
