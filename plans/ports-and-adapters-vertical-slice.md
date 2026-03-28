# Plan: Ports & Adapters Architecture with Effect TS

> Source PRD: Grilling session — establish hexagonal architecture pattern via Create Task vertical slice

## Architectural decisions

Durable decisions that apply across all phases:

- **Architecture**: Ports & Adapters (hexagonal). Domain layer has zero infrastructure imports.
- **DI framework**: Effect TS — `Context.GenericTag` for ports, `Layer` for adapters, `ManagedRuntime` for composition.
- **Effect depth**: Effect in domain/use case layers. Adapters wrap plain Drizzle calls into Effect at the boundary. Route handlers bridge back via `appRuntime.runPromise()`.
- **Domain types**: Plain TypeScript interfaces (no Effect Schema for now).
- **Error model**: `Data.TaggedError` classes per domain module.
- **Use case style**: Functions returning `Effect.gen` (not classes — Effect's `R` channel replaces constructor injection).
- **Ports**: `Context.GenericTag` interfaces with domain-only method signatures.
- **Adapters**: `Layer.effect` implementations that depend on infrastructure service tags (e.g., `Database`).
- **Database service**: Drizzle `db` instance wrapped in its own `Context.GenericTag` + `Layer` for testability.
- **Runtime**: Single `ManagedRuntime` built from one `AppLive` layer (split per-domain later if needed).
- **Route handler bridging**: Inline `Effect.match` + `appRuntime.runPromise` in each `+page.server.ts` action.
- **Directory structure**:
  - `src/lib/domain/<module>/` — entities, errors, ports, use cases
  - `src/lib/infrastructure/` — database tag, repository adapters
  - `src/lib/server/runtime.ts` — composition root + managed runtime
- **Routes**: `/demo/tasks` for the task management UI
- **Schema**: Existing `task` table (id, title, priority) in Drizzle schema

---

## Phase 1: Effect Bootstrap + Create Task E2E

**User stories**: As a user, I can submit a form to create a task and see it appear in a list, proving the full ports & adapters architecture works end-to-end.

### What to build

Install Effect TS. Define the `Task` domain entity and `CreateTaskInput` as plain interfaces. Create the `TaskRepository` port as a `Context.GenericTag` with `create` and `findAll` methods. Implement the `DrizzleTaskRepository` adapter as a `Layer.effect` that depends on a `Database` service tag. Build the `createTask` use case as a function returning `Effect.gen` that yields the `TaskRepository`. Wire everything together in a composition root that exports a single `ManagedRuntime`.

Create a `/demo/tasks` route with a SvelteKit form action. The action extracts form data, runs the `createTask` use case via the runtime, and on success the page reloads. The `load` function fetches all tasks through a `findAllTasks` use case and displays them in a list below the form.

This phase intentionally skips input validation and detailed error handling — the goal is to prove the architectural wiring from UI through domain to database and back.

### Acceptance criteria

- [ ] Effect TS is installed as a dependency
- [ ] `Task` interface and `CreateTaskInput` type exist in the domain layer with no infrastructure imports
- [ ] `TaskRepository` port is defined as a `Context.GenericTag` with `create` and `findAll` methods
- [ ] `DrizzleTaskRepository` adapter implements the port as a `Layer.effect` depending on a `Database` service tag
- [ ] `createTask` and `findAllTasks` use cases exist as functions returning `Effect.gen`
- [ ] A single `ManagedRuntime` is exported from the composition root
- [ ] `/demo/tasks` page displays a form with title and priority inputs and a submit button
- [ ] Submitting the form creates a row in the `task` table via the full use case → port → adapter path
- [ ] The page displays a list of all tasks loaded through the same architectural layers
- [ ] No domain code imports from `drizzle-orm`, `$lib/server/db`, or any infrastructure module

---

## Phase 2: Typed Error Handling E2E

**User stories**: As a user, I see clear error messages when I submit invalid data, and the system gracefully handles database failures — proving typed errors flow from domain through Effect to SvelteKit responses.

### What to build

Add `TaskValidationError` and `TaskRepositoryError` as `Data.TaggedError` classes in the domain layer. Add input validation logic to the `createTask` use case (e.g., title must be non-empty, priority must be positive). The use case now returns `Effect<Task, TaskValidationError | TaskRepositoryError, TaskRepository>`.

Update the route handler to use `Effect.match` to map errors to appropriate SvelteKit responses — `TaskValidationError` produces `fail(400, ...)`, `TaskRepositoryError` produces `fail(500, ...)`. The UI form displays the returned error message.

### Acceptance criteria

- [ ] `TaskValidationError` and `TaskRepositoryError` are `Data.TaggedError` classes in the domain layer
- [ ] `createTask` use case validates input and fails with `TaskValidationError` for bad data
- [ ] Repository adapter wraps Drizzle failures in `TaskRepositoryError`
- [ ] Route handler uses `Effect.match` to map `TaskValidationError` → 400 and `TaskRepositoryError` → 500
- [ ] Submitting an empty title shows a validation error in the UI
- [ ] Submitting a non-positive priority shows a validation error in the UI
- [ ] Error messages render in the form without a full page error

---

## Phase 3: Testing the Architecture

**User stories**: As a developer, I can run tests that verify each architectural boundary independently, proving the pattern is testable and sustainable for future features.

### What to build

Write a unit test for the `createTask` use case by providing a mock `TaskRepository` layer via `Layer.succeed` — no database involved. The test verifies use case logic (validation, delegation to repo) in isolation.

Write an integration test for the `DrizzleTaskRepository` adapter that runs against the real PostgreSQL instance (via Docker Compose). The test inserts and reads tasks, verifying the adapter correctly maps between domain types and database rows.

Write a component test for the `/demo/tasks` page that renders the form, submits it, and verifies the task appears in the list.

### Acceptance criteria

- [ ] Unit test: `createTask` use case tested with an in-memory `TaskRepository` layer, no DB
- [ ] Unit test: validation errors are produced for invalid input
- [ ] Integration test: `DrizzleTaskRepository` tested against real PostgreSQL
- [ ] Integration test: `create` inserts a row and `findAll` retrieves it
- [ ] Component test: `/demo/tasks` page renders form and task list
- [ ] All tests pass in CI-compatible configuration (`npm run test`)
