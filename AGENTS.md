# AGENTS.md

## Purpose

This file is the operational guide for AI coding agents working in this repository.

Keep the working context minimal. Do not read large parts of the repository unless the task requires it.

Prefer local discovery over global exploration.

For project-specific context (what this app does, stack, known bugs, ecosystem), see `CLAUDE.md` — read it first, always.

---

## Stack

- Framework: React 18 + Vite
- Language: TypeScript
- Routing: React Router
- Data fetching: TanStack Query v5
- Styling: Tailwind CSS v4 + shadcn/ui
- Forms: React Hook Form + Zod
- Tests: Vitest + Testing Library
- Package manager: npm

---

## Repository Structure

```text
src/
├── components/
│   ├── ui/          # shadcn/ui — generated, avoid hand-editing without reason
│   ├── dashboard/
│   ├── layout/
│   └── theme/
├── contexts/         # AuthContext, DashboardContext
├── hooks/
├── lib/               # cn() and generic utilities — not a dumping ground, see below
├── pages/
│   └── dashboard/
├── queries/           # TanStack Query hooks, one file per domain
├── services/          # api.ts — the ONLY place that talks HTTP to nova-api
├── theme/
└── test/

docs/                          # workspace root, shared across all 4 projects
└── PADRAO-RESPOSTA-V3.md      # response envelope of the backends' v3 (not consumed here yet)

AI-Friendly Architecture Specification.md   # workspace root — architectural rationale
```

---

## Context Strategy

For every task, minimize the amount of unrelated context loaded.

Use this discovery order:

1. Read `CLAUDE.md` (project context, hard rules).
2. Identify the relevant area (`components/`, `queries/`, `services/`, `pages/`).
3. Inspect files inside that area.
4. Check whether the module contains its own `AGENTS.md` (rare).
5. Read `docs/PADRAO-RESPOSTA-V3.md` only if the task involves integrating a `v3/` endpoint from a backend.
6. Use repository-wide search when local discovery is insufficient.

Do not explore the entire repository by default.

---

## Core Architecture Rules

### Feature Locality

Keep query hooks grouped by domain in `queries/` (`dashboardQueries.ts`, `exhaustQueries.ts`). Keep page-specific components inside `pages/dashboard/` rather than promoting them to `components/` unless reused.

### Cohesion

Keep related code together. Separate code when responsibilities differ, not merely because a pattern allows another file.

### Boundaries

- All HTTP calls to `nova-api` go through `services/api.ts` — never `fetch`/`axios` directly in a component or query hook.
- `nova-tag`/`nova-cie` are never called directly — always via `nova-api`'s gateway.
- `v2/` of any backend project is production surface. **Never edit it** — see the hard rule in `CLAUDE.md`.

### Abstractions

Do not create interfaces or wrappers without concrete value. Prefer shadcn/ui's CLI to generate new `components/ui/` primitives rather than hand-writing them, for consistency.

---

## Shared Code

`lib/` here holds truly generic utilities (`cn()` and similar). Feature-specific logic belongs in its own domain folder (`queries/`, `pages/dashboard/`), not `lib/`.

---

## Naming

Prefer descriptive, domain-specific names. Avoid vague names like `helper.ts`, `common.ts` when a more specific name is possible.

---

## Scope Discipline

Keep changes focused on the requested task. Do not perform unrelated refactoring, rename unrelated files, or edit a backend's `v2/` as a side effect of a frontend change.

---

## Validation

Before considering a change complete, run:

```bash
npm run lint
npm test
npm run build
```

All three are fast and catch most type/regression issues — run them before reporting a change as done.

---

## Dependencies

Before adding a new dependency, verify the requirement cannot reasonably be implemented with what is already installed. Prefer established, maintained libraries.

---

## Comments

Comments explain **why**, not **what**. Known gotchas (TanStack Query v5 generic cache typing, `next-themes` not exporting `ThemeProviderProps`) are already documented near the affected code — follow that pattern for new non-obvious constraints.

---

## Error Handling

- Never hardcode credentials or log tokens.
- `VITE_*` env vars are embedded in the JS bundle and visible in DevTools — never put a real secret there. The real protection is Cloudflare Access at the edge.

---

## Security

Treat all external input as untrusted where relevant (forms via React Hook Form + Zod).

Current auth (`VITE_AUTH_USER`/`VITE_AUTH_PASS`) is an operator selector, not real security — see `CLAUDE.md`. Do not reinforce the illusion of security in new code; real user authentication (Supabase Auth) is planned separately.

---

## Before Creating a New File

Ask:

1. Does this represent a distinct responsibility?
2. Could it remain coherently with existing code in the same domain folder?
3. Does separation improve context locality?

---

## Before Completing a Task

Verify:

- the requested behavior is implemented;
- no backend's `v2/` was touched;
- `npm run lint` passes;
- `npm test` passes;
- `npm run build` passes;
- CHANGELOG.md was updated (see the `commit` skill for the full flow).

---

## Primary Principle

When choosing between two implementations, prefer the one that allows a future developer or agent to understand and modify the feature while loading the least amount of unrelated context.

> Keep related code together.
> Preserve meaningful boundaries.
> Prefer explicit, simple structures.
> Load context progressively.
> Optimize for relevant context, not minimum file count.
