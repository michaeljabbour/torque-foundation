# Intents Conventions

This document guides AI agents and developers on how to construct and modify code within Torque intents.

## Core Directives

1. **Never write `routes` unless explicitly required.** Prefer defining `intents` and relying on Torque's Dual-Interface generation via the Kernel Registry.
2. **Never hardcode business logic** into Controllers. Utilize the Intent primitive to specify `successCriteria` and rely on the execution runtime.
3. **Always segregate dangerous tools.** Any capability exposed to an agent that modifies database state destructively must be registered under `Behavior.requireHumanConfirmation`.
4. **Safety is mathematical, not linguistic.** Never rely on prompt engineering for safety. Use `allowedTools` and `requireHumanConfirmation` for deterministic guarantees.

## The Three Primitives

| Primitive | Role | Key Properties |
|-----------|------|----------------|
| **Context** | What data the agent can see | `schema`, `vectorize` |
| **Behavior** | Execution guardrails | `persona`, `allowedTools`, `requireHumanConfirmation` |
| **Intent** | The goal and success criteria | `name`, `description`, `trigger`, `successCriteria`, `behavior` |

## Structure

An Intent triplet lives inside a bundle directory, nested under `intents/<IntentName>/`:

```
torque-bundle-<name>/
├── logic.js
├── intents/
│   └── <IntentName>/
│       ├── context.js      # Context primitive — data shape + vectorize fields
│       ├── behavior.js     # Behavior primitive — persona, tools, human gates
│       └── intent.js       # Intent primitive — goal, trigger, success criteria
├── manifest.yml
└── ui/
```

## Export Convention

A bundle's `logic.js` exposes intents to the Registry via the `intents()` method:

```javascript
import { MyIntent } from './intents/MyIntent/intent.js';

export default class BundleLogic {
  intents() {
    return {
      MyIntent,
    };
  }
}
```

The Kernel connects these to the AgentRouter, enabling LLM-powered execution out of the box.

## What the Kernel Does at Boot

1. Registry reads the mount plan and instantiates each bundle
2. Registry calls `instance.intents()` and stores each Intent as runtime metadata
3. `@torquedev/schema` wires type validation for interface contracts — the kernel checks that declared input/output shapes in manifest interfaces match at call time
4. Server auto-registers `POST /api/intents/{bundleName}/{intentKey}` for each Intent
5. HookBus emits `idd:intent_received`, `idd:executing`, `idd:intent_invoked` lifecycle events

## The Three Manifestations

When you define an Intent, the framework compiles it into three interfaces automatically:

| Manifestation | What | How |
|--------------|------|-----|
| **REST API** | `POST /api/intents/{bundle}/{intent}` | Standard JSON request — skips LLM for simple payloads |
| **Agent Tool Schema** | JSON schema passed to LLM | Agent knows the data shape, constraints, and success criteria |
| **Reactive Streams** | WebSocket events via HookBus | Real-time UI rendering of agent execution lifecycle |

## Intent Naming Conventions

- **Intent names**: PascalCase verbs/actions — `OrganizeWork`, `SummarizeBoard`, `FindAnything`
- **Triggers**: Natural language description — "User asks to organize, triage, or sort cards"
- **Success criteria**: Observable, verifiable statements — "All referenced cards are identified on the board"
- **Tools**: Use `bundle.interfaceName` format — `kanban.getBoardSnapshot`, `admin.assignRole`

## Behavior Guidelines

### allowedTools

List only the coordinator interfaces and data operations the agent needs. Less is more — the agent cannot call anything not listed.

```javascript
allowedTools: [
  'kanban.getBoardSnapshot',   // Read-only — safe
  'kanban.moveCard',           // Write — add to requireHumanConfirmation
  'identity.getUser',          // Cross-bundle read — safe
]
```

### requireHumanConfirmation

Any tool that modifies state destructively or irreversibly:

```javascript
requireHumanConfirmation: [
  'kanban.moveCard',     // Moves cards between lists
  'admin.assignRole',    // Grants permissions
  'admin.revokeRole',    // Revokes permissions
  'workspace.invite',    // Sends invitations
]
```

When the agent invokes a gated tool, the HookBus halts execution and emits a confirmation request to the frontend. The human approves or denies. Execution resumes or aborts.

### persona

Keep personas concise and role-specific:

```javascript
// Good — specific role, clear behavior
persona: 'You are a security-conscious access manager. Verify admin privileges before changes.'

// Bad — vague, no constraints
persona: 'You are a helpful assistant.'
```

## Observability: The Intent Trace

Every Intent execution produces a traceable lifecycle via the HookBus:

```
[INTENT: kanban.CreateCard] INITIATED by @alice
[INTENT: kanban.CreateCard] AGENT_THINKING
[INTENT: kanban.CreateCard] TOOL_INVOKED: 'database_insert'
[INTENT: kanban.CreateCard] SUCCESS_CRITERIA_MET
[INTENT: kanban.CreateCard] RESOLVED
```

This trace is as visible as an HTTP request log or SQL query log. No black-box AI — every agent action is attributed to an Intent with full context.

## VORM (Vector-Object Relational Mapping)

The `Context.vectorize` array tells the DataLayer to compute semantic embeddings for specified fields. This enables:

- Fuzzy natural-language search without SQL
- Semantic similarity matching for Intent routing
- Automatic context surfacing for agents

```javascript
export const SearchContext = new Context('Search', {
  schema: { query: 'string', entity_type: 'string' },
  vectorize: ['query'],  // Semantically indexed
});
```

## Intelligence Contracts

An Intent + Behavior pair functions as an **Intelligence Contract** — the equivalent of a blockchain smart contract. The contract guarantees:

- **Tool restriction**: The agent physically cannot call tools outside `allowedTools`
- **Human gating**: Tools in `requireHumanConfirmation` halt execution until approved (multisig-style)
- **Full traceability**: Every agent action is emitted to the HookBus as a structured event — an auditable behavioral ledger
- **Type-checked inputs and outputs via @torquedev/schema**: The kernel validates that values match declared types in manifest contracts — mismatched payloads are rejected before the agent or handler ever sees them

You don't trust the AI. You trust the Intelligence Contract wrapped around it. Safety is enforced at the runtime layer, not through prompt engineering.

The HookBus trace provides the same auditability as a blockchain explorer:

```
[Block 1] INTENT: kanban.CreateCard INITIATED by @alice
[Block 2] AGENT: Tool 'database_query' EXECUTED
[Block 3] AGENT: Success criteria validated
[Block 4] INTENT: RESOLVED
```

## Anti-Patterns

| Don't | Do Instead |
|-------|-----------|
| Write prompt engineering for safety ("please don't delete") | Use `requireHumanConfirmation` for deterministic gating |
| Create separate APIs for humans and agents | Use Dual-Interface — one Intent serves both |
| Hide agent execution in a black box | Pipe lifecycle through HookBus for full observability |
| Hardcode intent routing to specific URLs | Use semantic triggers — the AgentRouter matches dynamically |
| Write imperative if/else controllers | Declare successCriteria and let the runtime evaluate |
