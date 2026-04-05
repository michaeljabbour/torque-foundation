# Event patterns

Events are the primary mechanism for cross-bundle communication. This document defines the conventions that every bundle must follow when publishing or subscribing to events.

## Event anatomy

```javascript
eventBus.publish('pipeline.deal.stage_changed', {
  deal_id: 'abc-123',
  from_stage_id: 'stage-1',
  to_stage_id: 'stage-2',
  changed_by: 'user-456',
});
```

| Field | Convention |
|-------|-----------|
| Event name | `<bundle>.<entity>.<past_tense_verb>` |
| Payload keys | snake_case |
| ID values | UUID strings |
| Timestamps | ISO 8601 UTC (if included) |

## Naming rules

### The event name is a fact

Events describe what happened, not what should happen:

```
pipeline.deal.created          # A deal was created
identity.user.authenticated    # A user logged in
accounting.payment.processed   # A payment was processed

# NOT:
pipeline.deal.create           # This is a command, not an event
pipeline.deal.creating         # This is in-progress, not completed
pipeline.notify_analytics      # This names the subscriber, not the fact
```

### Bundle prefix is mandatory

Every event starts with the publishing bundle's name. This prevents namespace collisions and makes it clear who owns the event:

```
pipeline.deal.created          # Published by pipeline
identity.user.authenticated    # Published by identity
pulse.activity.recorded        # Published by pulse (if it published)
```

### Entity is singular

```
pipeline.deal.created          # Correct
pipeline.deals.created         # Wrong — use singular
```

## Payload conventions

### Always include the entity ID

```javascript
// Correct — includes the entity that changed
{ deal_id: 'abc-123', from_stage_id: 'stage-1', to_stage_id: 'stage-2' }

// Wrong — missing the entity reference
{ from_stage: 'New lead', to_stage: 'Contacted' }
```

### Use IDs, not denormalized data

```javascript
// Correct — subscribers resolve names themselves
{ deal_id: 'abc-123', changed_by: 'user-456' }

// Wrong — embeds data that might be stale
{ deal_title: 'Acme Corp', changed_by_name: 'Demo Admin' }
```

### Include enough context to avoid round-trips

```javascript
// Good — subscriber has enough to record an activity without extra queries
{
  deal_id: 'abc-123',
  title: 'Acme Corp',          // Included because it's immutable in this context
  amount_cents: 7500000,
  stage_id: 'stage-1',
  owner_id: 'user-456',
}

// Too minimal — subscriber must query pipeline for every field
{ deal_id: 'abc-123' }
```

The balance: include data that is known at publish time and unlikely to change. Leave out data that the subscriber should resolve fresh (like user names, which might have changed since the event).

## Subscription patterns

### Subscribe in setupSubscriptions only

```javascript
// Correct — during the kernel's subscription phase
setupSubscriptions(eventBus) {
  eventBus.subscribe('pipeline.deal.created', 'pulse', (payload) => {
    this._record({ ... });
  });
}

// Wrong — subscribing in the constructor or during a request
constructor({ events }) {
  events.subscribe('pipeline.deal.created', 'pulse', (payload) => { ... });
}
```

### Handle missing dependencies gracefully

If your subscription handler calls a coordinator interface, the target bundle might not be active:

```javascript
setupSubscriptions(eventBus) {
  eventBus.subscribe('pipeline.deal.stage_changed', 'pulse', (payload) => {
    let actorName = 'Unknown';
    try {
      const user = this.coordinator.call('identity', 'getUser', { userId: payload.changed_by });
      actorName = user?.name || 'Unknown';
    } catch {
      // Identity bundle not active — degrade gracefully
    }
    this._record({ actor_name: actorName, ... });
  });
}
```

### Don't throw from event handlers

If a handler throws, it's caught by the event bus and logged — but it stops other handlers from running. Always handle errors internally:

```javascript
// Correct
eventBus.subscribe('pipeline.deal.created', 'analytics', (payload) => {
  try {
    this.data.insert('metrics', { ... });
  } catch (e) {
    console.error(`[analytics] Failed to record metric: ${e.message}`);
  }
});
```

## Event catalog

### Identity bundle
| Event | Payload | When |
|-------|---------|------|
| `identity.user.authenticated` | `{ user_id, email }` | After successful sign-in or sign-up |
| `identity.session.created` | `{ user_id, jti }` | After JWT + refresh token created |
| `identity.auth.failed` | `{ email, reason, timestamp }` | After a failed sign-in attempt |
| `identity.session.revoked` | `{ user_id, revoked_count }` | After revokeUserSessions is called |

### Pipeline bundle
| Event | Payload | When |
|-------|---------|------|
| `pipeline.deal.created` | `{ deal_id, title, amount_cents, stage_id, owner_id }` | After deal inserted |
| `pipeline.deal.stage_changed` | `{ deal_id, from_stage_id, to_stage_id, changed_by }` | After stage transition |
| `pipeline.deal.archived` | `{ deal_id, archived_by }` | After deal archived |

### Tasks bundle
| Event | Payload | When |
|-------|---------|------|
| `tasks.task.created` | `{ task_id, title, entity_type, entity_id, assigned_to, created_by }` | After task inserted |
| `tasks.task.completed` | `{ task_id, completed_by }` | After task marked complete |

### Workspace bundle
| Event | Payload | When |
|-------|---------|------|
| `workspace.workspace.created` | `{ workspace_id, name, owner_id }` | After workspace inserted |
| `workspace.member.invited` | `{ workspace_id, email, invited_by }` | After invite sent |

### Boards bundle
| Event | Payload | When |
|-------|---------|------|
| `boards.board.created` | `{ board_id, workspace_id, name }` | After board inserted |
| `boards.board.updated` | `{ board_id, changes }` | After board updated |
| `boards.member.added` | `{ board_id, user_id, role }` | After member added to board |

### Kanban bundle
| Event | Payload | When |
|-------|---------|------|
| `kanban.list.created` | `{ list_id, board_id, name }` | After list inserted |
| `kanban.list.reordered` | `{ list_id, board_id, pos }` | After list position changed |
| `kanban.card.created` | `{ card_id, board_id, list_id, name, created_by }` | After card inserted |
| `kanban.card.updated` | `{ card_id, board_id, changes }` | After card fields changed |
| `kanban.card.moved` | `{ card_id, board_id, from_list_id, to_list_id, pos }` | After card moved between lists |
| `kanban.label.created` | `{ label_id, board_id, name, color }` | After label inserted |
| `kanban.checkitem.toggled` | `{ checkitem_id, card_id, checked }` | After checkitem checked/unchecked |

### Profile bundle
| Event | Payload | When |
|-------|---------|------|
| `profile.profile.updated` | `{ user_id, changes }` | After profile fields changed |

### Admin bundle
| Event | Payload | When |
|-------|---------|------|
| `admin.role.assigned` | `{ user_id, role_id, scope_type, scope_id }` | After role assigned to user |
| `admin.role.revoked` | `{ user_id, role_id }` | After role revoked from user |

### Activity bundle
Activity subscribes to events from kanban, boards, and workspace but does not publish its own events.

### Realtime bundle
Realtime subscribes to kanban and boards events and broadcasts them over WebSocket. No events published.

### Search bundle
Search subscribes to kanban and boards events to auto-index content. No events published.

### Planned events (from catalog)
| Event | Bundle | Status |
|-------|--------|--------|
| `entity.created` | entity-graph | planned |
| `entity.updated` | entity-graph | planned |
| `accounting.report.submitted` | accounting | planned |
| `accounting.payment.processed` | accounting | planned |
| `communications.message.sent` | communications | planned |
| `communications.call.completed` | communications | planned |
| `intelligence.completion.finished` | intelligence | planned |
| `integrations.document.signed` | integrations | planned |
| `integrations.offer.received` | integrations | planned |

## Event versioning (future)

When an event payload needs to change, add a version suffix:

```
pipeline.deal.created          # v1 (current)
pipeline.deal.created.v2       # v2 (new fields)
```

Publish both during a transition period. Subscribers migrate at their own pace. Remove the old event when all subscribers have updated. This is a future concern — not yet implemented.
