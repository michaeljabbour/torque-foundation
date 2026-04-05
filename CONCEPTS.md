# Torque Composition Concepts

## Quick Start (Rails-level simplicity)

```bash
torque new myapp --template kanban    # generates working app
cd myapp
npm install                            # one dependency: torque
npm start                              # auto-discovers bundles, starts server
# → http://localhost:9292 with seeded data
```

**No boot.js needed.** `torque start` auto-discovers bundles in `bundles/` directory.

**No mount plan needed.** Bundle dependencies in `manifest.yml` determine boot order.

**No config needed.** Sensible defaults: SQLite at `data/app.sqlite3`, port 9292, auth auto-detected from IAM bundle.

**One dependency.** `package.json` lists `torque` which includes everything.

### App Structure

```
myapp/
  package.json          ← { "dependencies": { "torque": "..." } }
  bundles/              ← auto-discovered, no YAML mount plan needed
    iam/                ← auth, RBAC, profiles, teams
      manifest.yml
      logic.js
      seeds.js          ← per-bundle seed data
      ui/
    kanban/              ← your domain logic
      manifest.yml
      logic.js
      seeds.js
      ui/
  ui/                   ← app-level theme + view overrides (optional)
  data/                 ← auto-created SQLite file
```

### Convention over Configuration

| Convention | Override |
|-----------|---------|
| Bundles in `bundles/` | Mount plan YAML with git sources |
| SQLite at `data/app.sqlite3` | `--db path/to/db` |
| Port 9292 | `--port 3000` |
| Auth from IAM bundle | Custom `authResolver` in boot.js |
| Per-bundle `seeds.js` | Global `seeds/index.js` |

## Module Taxonomy

Torque has four types of composable units. Choosing the right one matters:

### Bundle
A **self-contained domain module** with its own tables, routes, events, interfaces, and UI views.

- Has `manifest.yml` + `logic.js` + `ui/`
- Owns data (tables are bundle-scoped, isolated by DataLayer)
- Publishes/subscribes to events
- Exposes interfaces for cross-bundle calls
- Declares API routes auto-registered by the server

**Use when:** You own a coherent domain with its own data model.

**Examples:** `iam` (auth + roles + profiles + teams), `kanban-app` (workspaces + boards + cards), `activity-app` (feed + notifications), `search-app` (indexing + query)

### Behavior
A **cross-cutting concern** declared as a YAML file. No tables, no routes — just hooks, gates, event subscriptions, and context.

- Loaded via `behaviors:` in the mount plan
- Registers HookBus handlers (lifecycle observation)
- Registers gates (authorization, rate-limiting)
- Subscribes to events for side effects
- Includes context files for AI/agent awareness

**Use when:** You want to add a capability that spans multiple bundles without modifying them.

**Examples:** `audit-trail` (log all interface calls), `rate-limiter` (throttle routes), `rbac-enforcer` (check permissions at gates), `memory-capture` (record context for agents)

```yaml
# behaviors/audit-trail.yml
name: audit-trail
hooks:
  - position: interface:after-call
    handler: ./handlers/log-interface.js
  - position: route:after
    handler: ./handlers/log-route.js
context:
  include:
    - ./context/audit-rules.md
```

### Extension
A **service enhancement** published as an npm package. Wraps or decorates kernel services (DataLayer, EventBus, HookBus).

- Installed via npm, not mounted via YAML
- Extends kernel behavior (e.g., adds soft-delete to DataLayer)
- Configured in `boot.js`, not in mount plan
- No manifest, no isolation — operates at kernel level

**Use when:** You're adding infrastructure capability that all bundles benefit from.

**Examples:** `@torquedev/authorization` (RBAC via hookBus), `@torquedev/search` (FTS5 service), `@torquedev/datalayer-soft-delete` (adds deleted_at), `@torquedev/datalayer-storage` (S3 file uploads)

### Library
A **pure utility** with no Torque awareness. Imported directly by bundles.

- Standard npm package
- No manifest, no hooks, no events
- Used inside bundle `logic.js` via `import`

**Use when:** It's a generic utility not specific to Torque.

**Examples:** `bcryptjs` (password hashing), `jsonwebtoken` (JWT), `uuid` (ID generation)

## Composition Levels

### When to merge bundles

Merge when:
- **Same domain, shared data model** — workspace + boards + kanban all operate on the same project management data model. One `kanban-app` bundle is cleaner than three.
- **Tight coupling** — if every operation in bundle A requires a coordinator.call to bundle B, they should be one bundle.
- **Circular dependencies** — if A depends on B and B depends on A, merge them.

### When to split bundles

Split when:
- **Independent lifecycle** — search indexing can be disabled without affecting the kanban board.
- **Different consumers** — activity feed is consumed by the UI; realtime is consumed by WebSocket clients. But they share the same data model, so they're one bundle.
- **Optional capability** — admin panel is only for admins. But it shares the IAM data model (users, roles), so it's part of IAM.

### The 4-Bundle Pattern

Most apps decompose cleanly into 4 bundles:

```
IAM          — auth, users, roles, teams, profiles, preferences
Domain       — the app's core data model and business logic
Activity     — feed, notifications, comments, watchers, realtime
Search       — full-text indexing, query, suggestions
```

**Why 4?** This follows natural domain boundaries:
- IAM is always needed, never changes per-app
- Domain is the app-specific part (kanban, CRM, e-commerce, etc.)
- Activity is a cross-domain concern (every app has feeds/notifications)
- Search is infrastructure (indexes domain data, independent lifecycle)

### Dependency Flow

```
IAM (no deps)
  ↑ optional_deps
Domain (optional: IAM for user enrichment)
  ↑ depends_on
Activity (hard dep on Domain for card/board context)
Search (hard dep on Domain for indexing)
```

No circular dependencies. IAM boots first, Domain second, Activity and Search last.

## Bundle Anatomy

A well-composed bundle has this structure:

```
my-bundle/
├── manifest.yml      # Contract: tables, routes, events, interfaces, UI
├── logic.js          # Implementation: class with constructor, interfaces(), routes()
├── agent.md          # AI agent definition (frontmatter + markdown)
├── ui/               # UI view descriptors
│   ├── index.js      # exports { views: { 'view-name': ViewFn } }
│   ├── ViewName.js   # descriptor-returning function
│   └── ui-kit.js     # el() helpers for this bundle
├── test/             # Tests (node --test)
└── package.json      # npm metadata
```

### Constructor Pattern

Every bundle receives four capabilities:

```javascript
constructor({ data, events, config, coordinator }) {
  this.data = data;           // BundleScopedData — only your tables
  this.events = events;       // EventBus — publish declared events
  this.config = config;       // Config from mount plan YAML
  this.coordinator = coordinator; // ScopedCoordinator — call declared deps only
}
```

### Interface vs Route

- **Interface** = internal API for other bundles (via `coordinator.call`)
- **Route** = external API for HTTP clients (auto-registered by server)

Both are defined in `routes()` and `interfaces()` respectively. Interfaces have type contracts (input/output shapes validated by kernel). Routes have auth flags.

### Event vs Hook

- **Event** = domain fact (past tense, published by bundle) — `kanban.card.created`
- **Hook** = lifecycle observation point (present tense, registered by kernel) — `route:before`

Events are for business logic side effects. Hooks are for infrastructure concerns (auth, logging, metrics).

## @mention References

Bundles can reference each other's files using `@bundleName:path`:

```markdown
# In activity-app/agent.md
See @kanban-app:context/card-model.md for the card data model.
See @iam:context/permission-rules.md for access control.
```

Resolved at boot time by the Registry's `resolveBundleRef()` method.

## includes: Composition

Bundles can include other bundles to create meta-bundles:

```yaml
# In a meta-bundle's manifest.yml
name: project-management
includes:
  - kanban-app
  - activity-app
  - search-app
```

Included bundles are treated as implicit `depends_on` entries. The topological sort ensures they boot in the right order.
