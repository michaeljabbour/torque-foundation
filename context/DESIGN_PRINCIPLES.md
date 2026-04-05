# Design principles

These principles govern every decision in the Torque ecosystem. When in doubt, return to these.

## 1. The mount plan is the product

An application is defined by a YAML file — not a codebase. Changing what an app does means editing the mount plan, not writing code. This is the most important principle. If a feature requires code changes in multiple repos to "turn on," the architecture has failed.

## 2. Bundles are stateless compute with declared schemas

A bundle declares what it needs and what it provides. The kernel and shared services supply everything else. A bundle never:
- Holds a database connection
- Imports another bundle's code
- Reads environment variables directly
- Knows what application it's part of

## 3. Events are facts, not commands

`pipeline.deal.stage_changed` is a statement that something happened — not a request for someone to do something. Events fire whether or not anyone subscribes. This is what makes bundles independently deployable.

## 4. Interfaces are stable contracts, not convenience wrappers

When identity exposes `getUser({ userId })`, it returns `{ id, name, email, role }` — a DTO that won't change when identity's internal schema changes. Interfaces are the public API of a bundle. They should be small, focused, and versioned.

## 5. The kernel provides mechanisms, not policies

The kernel knows how to resolve bundles, boot them, route requests, and enforce isolation. It does not know what a "deal" is, what "funded" means, or how to calculate a commission split. Business logic lives in bundles. Always.

## 6. Domain-neutral naming

Not "CRM contact" — "entity." Not "Twilio SMS" — "message channel." Not "deal pipeline" — "stage-based workflow." Names should work across verticals. A pipeline bundle should work for deal tracking, recruiting, support tickets, or any item-through-stages process.

## 7. Convention over configuration, configuration over code

Follow the conventions in this foundation. When conventions don't cover your case, use configuration (mount plan). When configuration isn't enough, write code in a bundle. Never write code when configuration would suffice.

## 8. Small, boring, stable center — fast, interesting edges

The kernel, data layer, and event bus should be boring. They should change rarely and never break. Bundles are where innovation happens. A new feature is a new bundle or a bundle update — never a kernel change.

## 9. Composition over inheritance

Bundles don't extend each other. They compose through events and interfaces. There is no "base bundle." There is no class hierarchy. Each bundle is a flat, self-contained unit that the kernel orchestrates.

## 10. Frontend and backend compose the same way

Backend routes auto-register from manifest declarations. Frontend views are no different: bundles export view functions that return ui-kit descriptors (pure JavaScript, framework-agnostic). The shell provides a renderer that maps those descriptors to React+MUI components. Adding a bundle with API endpoints and a UI view requires zero edits to the server or the shell. If you find yourself editing the shell renderer or `server/index.js` to support a new bundle, the architecture has failed. The mount plan is the product — on both sides of the stack.

The three layers of the frontend architecture:
- **Shell (mechanism):** Provides React+MUI rendering, routing, theme
- **UI Kit (protocol):** Pure JS descriptor functions, zero framework deps
- **Bundles (policy):** Compose from ui-kit, framework-agnostic, reusable

The swap test: to move from React+MUI to Vue+Vuetify, rewrite the shell. Bundles and ui-kit are untouched.

## 11. Delete before you abstract

If a pattern appears in two bundles, leave it duplicated. If it appears in five, consider a shared service. Never create an abstraction for fewer than three concrete use cases. The cost of a wrong abstraction is higher than the cost of duplication.

## 12. Bundles live in their own repos, composed via git

Every bundle is an independent git repository with its own version, tests, and release cycle. Applications compose bundles by declaring git sources in a mount plan — no local copies, no monorepo. The kernel resolver clones bundles into `.bundles/` at boot time and caches them with a `bundle.lock` for reproducible builds.

This means:
- A bundle can be reused across multiple apps (kanban, CRM, todo) without copying code
- Bundle updates are opt-in: pin to a tag or commit SHA for stability
- The CLI template defines bundles as `name → git+https://` — not as embedded directories
- Development uses `path:` sources via `dev-link.sh` for instant feedback

If a bundle can't be developed, tested, and versioned independently of any specific application, it's not a proper bundle yet.

## 13. Bundles describe, the shell renders

Bundles compose UI from `@torquedev/ui-kit` descriptor functions—pure JavaScript functions that return declarative component trees, with zero framework dependencies. The shell provides a renderer that maps those descriptors to framework-specific components (React+MUI today, anything tomorrow). Swapping frameworks means rewriting the shell renderer, not touching a single bundle. This keeps bundles portable across applications and frameworks. A bundle's UI is a data structure, not a component tree.

## 14. Type-checked contracts are the enforced truth

Manifests declare types on every interface input, output, and event payload field. The kernel validates these types at runtime via @torquedev/schema as the primary enforcement mechanism. If manifest says itemId: uuid and you pass a number, the call is rejected before business logic runs. The contract is the API documentation, the runtime validation, and the test assertion -- all in one place. If the contract is wrong, fix the contract. If the code disagrees with the contract, the code is wrong.
