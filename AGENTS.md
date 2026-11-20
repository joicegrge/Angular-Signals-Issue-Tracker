# Angular Signals Assignment: Issue Tracker

## Project overview and objectives

Build a Kanban style issue tracker for bugs, tasks, and stories, following the attached assignment. This repository is currently at the initial project setup stage; do not implement tracker functionality until explicitly requested.

## Technology stack

- Angular 22 (scaffolded with Angular 22.3.0 packages).
- TypeScript 6.x.
- Standalone components with `ChangeDetectionStrategy.OnPush`.
- Angular signal APIs for component inputs, outputs, derived state, and shared state.
- Plain CSS or Angular Material; prefer plain CSS unless the feature needs Material.
- npm scripts and the Angular CLI; Vitest is configured for unit tests.
- No backend, database, or external state management library. Load seed data from JSON under `public/`; persist local changes in browser storage.

## Project structure

Current Angular CLI scaffold:

```text
.
├── public/                  # Static assets and, when implemented, seed JSON
├── src/
│   ├── app/
│   │   ├── app.ts           # Standalone root component (OnPush)
│   │   ├── app.html
│   │   ├── app.css
│   │   ├── app.config.ts
│   │   ├── app.routes.ts
│   │   └── app.spec.ts
│   ├── index.html
│   ├── main.ts
│   └── styles.css
├── angular.json
├── package.json
└── tsconfig*.json
```

As features are added, keep reusable UI in `src/app/components/`, domain types in `src/app/models/`, and shared issue state in `src/app/services/issue-store.ts`. Keep the separate reusable `IssueCard` and `IssueDetailPanel` components. Put seed files at `public/issues.json` and `public/team.json` as required by the assignment.

## Development and testing commands

- `npm install` - install dependencies.
- `npm start` - serve the app locally (Angular CLI default is `http://localhost:4200`).
- `npm run build` - create a production build.
- `npm test` - run unit tests through Angular's configured Vitest builder.

## Angular coding conventions

- Use standalone components and `ChangeDetectionStrategy.OnPush`.
- Use `input()`, `input.required()`, `output()`, and `model()` rather than decorator-based inputs or outputs.
- Use `@if` and `@for` with a stable, meaningful `track` expression; do not use `*ngIf` or `*ngFor`.
- Keep components focused on presentation and user interaction. Put shared state and business rules in `IssueStore`.
- Prefer strict types, small focused methods, semantic HTML, accessible labels, and plain CSS scoped to the relevant component.
- Prefer Signal Forms; Reactive Forms are acceptable when needed.

## Signal-based state management requirements

- `IssueStore` owns all shared issue data. Keep writable signals private and expose read-only signals to components; components call store methods to make changes.
- Derive values with `computed()` and `linkedSignal()`. Do not set signals inside `effect()` to calculate derived state.
- Use immutable updates for arrays and issue objects.
- Use `httpResource()` or `resource()` to load the seed JSON and expose loading/error states. Do not call `.subscribe()` in components.
- Use `effect()` only to persist state to browser storage. Keep effects out of business rule enforcement and derived-state logic.
- No NgRx, Akita, signals libraries, or other external state management packages. Do not use `BehaviorSubject` as a store.

## Assignment requirements and restrictions

- Implement only functionality described in the assignment. Do not add a backend or database.
- Create at least 15 seed issues in `public/issues.json` and at least 4 team members in `public/team.json`. Include some overdue and unassigned issues and one assignee with at least 3 issues already In Progress.
- Issue fields: `id`, `title`, `description`, `type` (`Bug | Task | Story`), `priority` (`Critical | High | Medium | Low`), `status` (`To Do | In Progress | In Review | Done`), `assigneeId` (string or null), `storyPoints` (1, 2, 3, 5, or 8), and `dueDate` (ISO date string or null). Team member fields: `id` and `name`.
- The board has four status columns. Each column shows its issue count and story point total. Cards show ID, title, type, priority, assignee name or `Unassigned`, and due date. Sort cards by priority (Critical first), then earliest due date. Show an `Overdue` label when BR-6 applies.
- Search by title or ID without case sensitivity, applying 300 ms after typing stops. Filter together across all columns by assignee (all, unassigned, or a team member) and priority. Show the filtered count and a Clear filters action. Column counts and the filtered count use filtered issues; the summary bar always uses all issues.
- The summary bar shows open issue count (not Done), overdue issue count, and completion percentage.
- Clicking a card opens an issue detail side panel with all fields. Allow editing title, priority, assignee, and story points with Save/Cancel. Cancel discards changes; selecting another card while editing discards unsaved edits. Show only allowed status moves.
- New issue form fields: title, description, type, priority, story points, due date, optional assignee. Require a title of at least 5 characters; due date cannot be in the past; disable Save while invalid. Assign the next ID and initial `To Do` status.
- Show loading and error states for JSON loading. Changes survive refresh. Reset data clears saved changes and reloads seed data.
- Implement BR-1 through BR-5 inside `IssueStore`, not in components:
  - **BR-1 Workflow:** `To Do -> In Progress`; `In Progress -> In Review` or `To Do`; `In Review -> Done` or `In Progress`; `Done -> To Do` (reopen).
  - **BR-2 Assignment:** An issue cannot enter In Progress without an assignee. An issue in In Progress cannot be unassigned.
  - **BR-3 WIP limit:** A person may have at most 3 issues in In Progress. Block moves or reassignments that break the limit and show a clear message.
  - **BR-4 Story points:** Values must be one of 1, 2, 3, 5, or 8.
  - **BR-5 Reopen:** Reopening (`Done -> To Do`) clears the due date; a due date must be set again before the issue can move to In Progress.
- Also implement the assignment's **BR-6 Overdue** rule: a due date before today is overdue only if status is not Done; a due date of today is not overdue.
- Also implement **BR-7 Completion %**: Done issue story points divided by all issue story points, times 100, rounded to nearest whole number; show 0% when total story points is 0.
- Also implement **BR-8 Counts**: summary bar metrics use all issues; board column counts and `Showing X of Y issues` use filtered issues.
- Required Angular APIs: `input()`, `input.required()`, `output()`, `model()`, `computed()`, `linkedSignal()`, and `httpResource()` or `resource()` as appropriate. `effect()` is for persistence only.

## Never rules

- Never implement a business rule only in a component; enforce BR-1 to BR-5 in `IssueStore`.
- Never mutate issue objects or arrays in place.
- Never use decorator-based `@Input()`/`@Output()`, `EventEmitter`, `ngOnChanges`, `*ngIf`, or `*ngFor`.
- Never call `.subscribe()` in a component.
- Never set signals inside an `effect()` to derive or synchronize application state.
- Never use `BehaviorSubject` or add an external state management library.
- Never add a backend, database, or features outside the assignment.
- Never allow an invalid status transition, an unassigned In Progress issue, or a per-assignee In Progress count above 3.

## Definition of Done

- The requested change matches an assignment requirement and respects all restrictions above.
- State ownership and business rules remain in `IssueStore`; updates are immutable and UI uses standalone OnPush components and signal APIs.
- Loading, error, validation, and relevant empty states are handled where applicable.
- Relevant checks pass, and the final report names changed files and check results. Do not commit until the user has reviewed the work.
