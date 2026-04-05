# Migration guide: extracting bundles from a monolith

This guide covers the process of extracting a bundle from the existing MyRM monolith (or any Rails/Node monolith) into the Torque composable architecture.

## Prerequisites

- Read the [composability analysis](../../../myrm-composability-analysis.md) for the full file-to-module mapping
- Read the [bundle guide](https://github.com/torque-framework/torque-core/blob/main/docs/BUNDLE_GUIDE.md) to understand bundle structure
- Check the [bundle catalog](../catalog/bundles.yml) to see what's planned and what exists

## The extraction process

### Step 1: Define the boundary

Look at the composability analysis for your target bundle. Identify:

1. **Tables this bundle owns** — these become the bundle's schema declaration
2. **Tables this bundle reads from other bundles** — these become coordinator interface calls
3. **External APIs this bundle calls** — these stay in the bundle (or move to an integrations bundle)
4. **Events this bundle should publish** — state changes that other parts of the system react to
5. **Events this bundle should subscribe to** — state changes from other bundles it needs

Write the manifest first, before writing any logic.

### Step 2: Map the monolith files

For each file in the monolith that maps to your bundle:

| Monolith pattern | Bundle equivalent |
|-----------------|-------------------|
| ActiveRecord model | manifest.yml schema declaration |
| Model associations to other domains | Coordinator interface calls |
| Model associations within this domain | Data layer queries with filters |
| Interactor/service object | Method on the bundle class |
| GraphQL mutation | Method on the bundle class |
| GraphQL resolver | Method on the bundle class (query) or coordinator interface |
| Background job | Method on the bundle class (synchronous for now) |
| Mailer | Event publication (a notifications bundle subscribes) |
| Policy (authorization) | Logic in the bundle method or a separate auth interface |
| Webhook controller | Event publication from the integrations bundle |

### Step 3: Handle boundary violations

The composability analysis identifies boundary violations — places where one domain directly accesses another domain's internals. Each violation needs a fix:

| Violation pattern | Fix |
|------------------|-----|
| Direct model access across domains | Replace with coordinator interface call |
| Shared database table | Assign ownership to one bundle, others use interfaces |
| Direct method call across domains | Replace with event publication + subscription |
| Shared ActiveRecord concern | Duplicate the relevant logic into each bundle that needs it |
| Join across domain tables | Replace with ID reference + coordinator resolution |

### Step 4: Write the bundle

1. Create the repo: `torque-bundle-<name>/`
2. Write `manifest.yml` with schema, events, interfaces — include typed input/output shapes for each interface so `@torquedev/schema` can validate contracts at runtime
3. Write `logic.js` implementing the bundle class
4. (Optional) Add an `intents/` directory with intent triplets (context, behavior, intent) for operations that benefit from agent intelligence. Use `torque generate intent <bundle> <name>` to scaffold them.
5. Translate Ruby logic to JavaScript:

```ruby
# Ruby (monolith)
class CreateBusinessProduct
  def call
    product = BusinessProduct.create!(
      title: params[:title],
      amount_requested_cents: params[:amount],
      stage_id: default_stage.id,
      owner_id: current_user.id,
    )
    AnalyticsTracker.track(:business_product_created, product)
    product
  end
end
```

```javascript
// JavaScript (bundle)
createDeal({ title, amount_cents, stage_id, owner_id }) {
  const deal = this.data.insert('deals', {
    title, amount_cents, stage_id, owner_id, status: 'active',
  });
  this.events.publish('pipeline.deal.created', {
    deal_id: deal.id, title, amount_cents, stage_id, owner_id,
  });
  return deal;
}
```

Key translations:
- `Model.create!` → `this.data.insert(table, attrs)`
- `Model.find(id)` → `this.data.find(table, id)`
- `Model.where(...)` → `this.data.query(table, filters)`
- `model.update!(...)` → `this.data.update(table, id, attrs)`
- `AnalyticsTracker.track(...)` → `this.events.publish(...)`
- `OtherModel.find(id)` → `this.coordinator.call(bundle, 'getEntity', { id })`
- `has_many :through` → multiple data layer queries or coordinator calls

### Step 5: Add to mount plan and test

1. Add the bundle to `mount-plans/development.yml`
2. Boot the app: `rm -rf .bundles data && node boot.js`
3. Verify the boot log shows your bundle
4. Test each interface and event
5. Verify no existing bundle changed (git diff = 0)

## Extraction status

### Extracted (13 bundles, all private repos on GitHub)

| # | Bundle | Difficulty | Deps | Repo |
|---|--------|-----------|------|------|
| 1 | identity | easy | — | `torque-bundle-identity` |
| 2 | pipeline | moderate | — | `torque-bundle-pipeline` |
| 3 | pulse | easy | — | `torque-bundle-pulse` |
| 4 | tasks | easy | — | `torque-bundle-tasks` |
| 5 | graphql | easy | — | `torque-bundle-graphql` |
| 6 | workspace | easy | — | `torque-bundle-workspace` |
| 7 | boards | easy | workspace | `torque-bundle-boards` |
| 8 | kanban | moderate | boards | `torque-bundle-kanban` |
| 9 | activity | easy | kanban, boards | `torque-bundle-activity` |
| 10 | realtime | easy | kanban, boards | `torque-bundle-realtime` |
| 11 | profile | easy | — | `torque-bundle-profile` |
| 12 | admin | easy | — | `torque-bundle-admin` |
| 13 | search | easy | — | `torque-bundle-search` |

### Remaining (planned for MyRM migration)

| Bundle | Difficulty | Deps | Notes |
|--------|-----------|------|-------|
| intelligence | easy | identity | AI chat/completions |
| integrations | easy | identity | External API connections |
| communications | moderate | identity, entity-graph | SMS, voice, email |
| analytics | moderate | many | Metrics, leaderboards |
| accounting | moderate | entity-graph, pipeline | Funding, payments, splits |
| entity-graph | **hard** | — | The gravity well — 50+ tables, most bundles reference it |

**Why entity-graph is last:** It's the most coupled domain. 50+ tables, 30+ associations to the User model, referenced by nearly every other module. Extract everything else first so you know exactly what interfaces entity-graph needs to expose.

## Bundle development workflow

Once extracted, each bundle lives in its own git repo. The development cycle:

```bash
# 1. Create the bundle repo
mkdir torque-bundle-<name> && cd torque-bundle-<name>
git init

# 2. Scaffold the bundle files
#    manifest.yml, logic.js, agent.md, package.json, .gitignore, test/, ui/

# 3. Package.json follows the convention:
cat package.json
{
  "name": "@torquedev/bundle-<name>",
  "version": "0.1.0",
  "description": "...",
  "type": "module",
  "main": "logic.js",
  "license": "MIT",
  "scripts": { "test": "node --test 'test/*.test.js'" }
}

# 4. Push privately to GitHub
gh repo create torque-framework/torque-bundle-<name> --private --source=. --push

# 5. Register in catalog/bundles.yml with status: released
# 6. Add to mount plans (git source for production, path: for development)
# 7. Add to dev-link.sh for local cross-repo development
```

### Mount plan sources

```yaml
# Production — resolved from git at boot time, cached in .bundles/
kanban:
  source: "git+https://github.com/torque-framework/torque-bundle-kanban.git@main"

# Development — symlinked via dev-link.sh for instant edits
kanban:
  source: "path:../../torque-bundle-kanban"
```

## Common pitfalls

### "I need a shared utility"
You probably don't. If two bundles both need to format money, duplicate the three-line function. It's cheaper than a shared dependency. Only create a shared service when the logic is substantial and genuinely shared across 3+ bundles.

### "My bundle needs to call 10 interfaces on another bundle"
Your bundle boundary is wrong. If pipeline needs 10 interfaces from entity-graph, either pipeline is too broad (it should be split) or entity-graph is too granular (those interfaces should be consolidated into fewer, richer queries).

### "I need to join data across bundles"
You don't. Fetch from each bundle separately and combine in the caller:
```javascript
const deal = this.coordinator.call('pipeline', 'getDeal', { dealId });
const owner = this.coordinator.call('identity', 'getUser', { userId: deal.owner_id });
return { ...deal, owner_name: owner.name };
```

### "My event handler needs to write to another bundle's table"
That means the handler belongs in the other bundle, or you need a new bundle. A pulse handler writes to `pulse_activities` — it never writes to `pipeline_deals`.

### "How do I handle transactions across bundles?"
You don't — at least not with distributed transactions. Use eventual consistency: bundle A publishes an event, bundle B subscribes and writes its own data. If B fails, it logs the error and retries later (or a human investigates). This is a feature, not a limitation — it's what makes bundles independently deployable.
