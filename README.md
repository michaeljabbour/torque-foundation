# torque-foundation

The shared knowledge base for the Torque composable application platform. Contains the bundle catalog, design documents, AI agent definitions, reference mount plans, CLI recipes, and AI skills that keep the ecosystem coherent.

Published on npm as `@torquedev/foundation`. No runtime code, no build step. It is consumed by the Torque CLI and application configurations.

## What's Here

```
torque-foundation/
  catalog/
    bundles.yml           Authoritative registry of every bundle in the ecosystem
  context/
    DESIGN_PRINCIPLES.md  13 rules that govern bundle design
    DOMAIN_CONVENTIONS.md Naming, data types, versioning, repo structure
    EVENT_PATTERNS.md     Event naming, payloads, subscription patterns + full catalog
    INTENTS_CONVENTIONS.md    Intents: Context/Behavior/Intent primitives
    MIGRATION_GUIDE.md    Extracting domains from a monolith into bundles
  agents/
    bundle-architect.md   AI agent for designing new bundles from requirements
    code-reviewer.md      AI agent for reviewing bundle code against contracts
  behaviors/
    ai-assisted.yaml      Loads all context docs + agents (for AI-powered development)
    development.yaml      Dev-mode defaults: verbose errors, seed on boot, debug logging
    audit-trail.yaml      Subscribes to lifecycle events, 90-day JSONL retention
  mount-plans/
    minimal.yml           Identity only
    standard.yml          Identity + pipeline + pulse + tasks
    development.yml       All 12 bundles, path: sources for local development
    full.yml              All 12 bundles from git, + 6 planned bundles (commented out)
  recipes/
    validate-all.yaml     5-step: composability check -> tests -> manifests -> agents -> summary
    onboard-bundle.yaml   8-step: scaffold -> design -> generate -> implement -> test -> review
    extract-from-monolith.yaml  7-step: analyze -> map -> design -> scaffold -> implement -> validate -> migrate
  skills/
    explain-bundle/       Deep-explain any bundle's contract and behavior
    new-bundle/           Scaffold + design + generate + test a new bundle
    review-bundle/        Full contract compliance review
```

## Bundle Catalog

`catalog/bundles.yml` is the authoritative registry of the entire ecosystem. Every entry declares: version, status, git source, description, tables, published events, interfaces, and dependencies.

### Released (12 bundles)

| Bundle | Description | Tables | Depends On |
|--------|-------------|--------|------------|
| identity | Authentication, JWT sessions | users, refresh_tokens | -- |
| pipeline | Stage-based workflow engine | stages, deals | -- |
| pulse | Activity timeline | activities | -- |
| tasks | Task management | tasks | -- |
| workspace | Organizations, members, invites | workspaces, memberships, invites | -- |
| boards | Boards within workspaces | boards, board_memberships | workspace |
| kanban | Lists, cards, labels, checklists | lists, cards, labels, checklists, checkitems | boards |
| activity | Activity feed, comments, notifications | actions, notifications, watchers | kanban, boards |
| realtime | WebSocket broadcast | (none) | kanban, boards |
| profile | User profiles, preferences | profiles, search_history | -- |
| admin | Roles, permissions, RBAC | roles, user_roles | -- |
| search | Full-text search, typeahead | search_entries | -- |

### Planned (6 bundles, reserved for monolith extraction)

| Bundle | Difficulty | Notes |
|--------|-----------|-------|
| entity-graph | hard | 50+ tables, referenced by everything -- extract last |
| accounting | moderate | Funding, payments, splits |
| communications | moderate | SMS, voice, email campaigns |
| analytics | moderate | Metrics, leaderboards |
| intelligence | easy | AI chat/completions |
| integrations | easy | DocuSign, external offers, compliance |

## Context Documents

Five markdown files that serve as the living constitution of the platform. Loaded into AI agent context via behaviors, and referenced by both humans and AI agents:

| Document | What It Covers |
|----------|----------------|
| **DESIGN_PRINCIPLES.md** | 13 rules. Key ones: "the mount plan is the product," "bundles are stateless compute with declared schemas," "events are facts, not commands" |
| **DOMAIN_CONVENTIONS.md** | Naming rules (tables, columns, events, interfaces), data types (UUIDs, integer cents, ISO 8601 UTC), cross-bundle references, repo structure, versioning |
| **EVENT_PATTERNS.md** | Event anatomy, naming rules, payload conventions, subscription patterns, full catalog of 37 events across all 12 bundles, versioning strategy |
| **INTENTS_CONVENTIONS.md** | Intents: Context (what), Behavior (how), Intent (why). One Intent compiles to REST API + agent tool schema + HookBus hook automatically |
| **MIGRATION_GUIDE.md** | Step-by-step extraction playbook for pulling domains from a Rails monolith into Torque bundles, with Ruby-to-JS translation cheat sheet |

## Agents

| Agent | Purpose | Modes |
|-------|---------|-------|
| **bundle-architect** | Design new bundles from requirements | `analyze` (identify entities), `design` (generate manifest), `review` (validate contracts) |
| **code-reviewer** | Review bundle code for contract compliance | `review` (full review), `quick-check` (contracts only) |

Both agents load context documents automatically and enforce Torque conventions (no cross-bundle imports, integer cents for money, UUIDs for IDs, past-tense events).

## Behaviors

Behaviors are named mode packs that declare which context documents and agents to activate:

| Behavior | Loads | Use Case |
|----------|-------|----------|
| `ai-assisted` | All 4 context docs + both agents | AI-powered development |
| `development` | 3 context docs + verbose errors + seed on boot | Local development |
| `audit-trail` | Event subscriptions for pipeline/identity | Compliance logging |

## Mount Plans

Reference configurations for different scenarios:

| Plan | Bundles | Source Type | Use Case |
|------|---------|-------------|----------|
| `minimal.yml` | identity | git | Auth-only app |
| `standard.yml` | identity, pipeline, pulse, tasks | git | Deal tracking app |
| `development.yml` | All 12 | `path:` (local) | Framework development |
| `full.yml` | All 12 + 6 planned (commented) | git | Production target |

## Installation

Install from npm:

```bash
npm install @torquedev/foundation
```

Alternatively, reference via git dependency:

```
"@torquedev/foundation": "git+https://github.com/torque-framework/torque-foundation.git@main"
```

The Torque CLI also discovers it at `../torque-foundation/` relative to the workspace, or via explicit configuration.

## File Conventions

- `.yaml` for behaviors and recipes
- `.yml` for mount plans and catalog entries
- `.md` for context documents, agents, and skills

## License

MIT — see [LICENSE](./LICENSE)
