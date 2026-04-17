---
title: Architecture
description: Three layers, one in-memory index, one SQLite database.
---

The backend is structured in three layers: a stateless query layer on top, a
shared cache layer in the middle, and the ZPA SDK at the bottom. The
in-memory index between the cache and the query layer holds the inverted
backlinks that drive search, reachability, and the analytics reports.

## Layer overview

<pre class="mermaid">
flowchart TD
    FE[Frontend<br/>React + Vite + PatternFly<br/>api.gen.ts] --> Q
    Q[Query layer<br/>internal/server/handlers.go] --> I
    I[Index layer<br/>internal/index/index.go] --> F
    F[Fetch layer<br/>internal/fetcher/fetcher.go] --> ZPA[ZPA Public API]
</pre>

### Fetch layer

`internal/fetcher` exposes one `CachedFetch[T]` helper plus a `LoadX`
function per ZPA resource. Each resource has its own `Cache[T]` with a
TTL: 5 minutes for volatile resources (segments, segment groups, access
policies, server groups, app connectors, SCIM groups, posture profiles,
trusted networks, application servers) and 1 hour for stable resources
(client types, platforms, IdP controllers, SCIM attribute headers,
certificates).

When the TTL expires, the next call to `CachedFetch` triggers a refetch.
On fetch failure, the cache returns the last-good data with the error so
transient SDK failures do not break read paths.

`Cache.Get` rechecks freshness after acquiring the write lock, so N
concurrent callers arriving after expiry collapse to a single fetch
rather than each firing one in sequence.

SCIM attribute values are loaded lazily per `(idpID, headerID)` pair via
`CachedSnapshot.ScimValueCacheFor`. The pair is the cache key because
values vary per header, not per IdP. The index build does not enumerate
them; the `GetScimAttributeValues` handler triggers a fetch on first
access for that pair.

Refresh is reactive (request-driven), not proactive. The first request
after each TTL expiry pays the SDK round-trip. See
[Roadmap](/reference/roadmap/).

### Index layer

`BuildIndex(ctx)` pulls every required resource through `CachedFetch` and
constructs the `Index` struct. Direct maps cover `Segments`, `Policies`,
`SegmentGroups`, and similar resources. Inverted indexes cover the
backlinks:

| Inverted index             | Purpose |
|----------------------------|---------|
| `SegmentToPolicies`        | Policies referencing a segment. |
| `GroupToPolicies`          | Policies referencing a segment group. |
| `DomainToSegments`         | Segments covering a hostname. |
| `ScimAttrNameToID`         | Name lookup for SCIM attribute headers. |
| `OrphanSegments`           | Segments with zero policy coverage. |
| `DisabledSegments`         | Segments flagged disabled. |
| `OverlappingDomains`       | Domains appearing in more than one segment. |
| `PolicyToScimGroups`       | SCIM groups granted access by a policy. |
| `ConnectorGroupToPolicies` | Policies dependent on a connector group. |
| `PolicyToConnectorGroups`  | Connector groups dependent on by a policy. |
| `ConnectorGroupNames`      | ID → name lookup. |

The backlinks make search, reachability, and the analytics layer constant
or near-constant lookups instead of full traversals.

### Query layer

`internal/server/handlers.go` is the only entry point the frontend calls.
Each handler is a method on `*Server`. Handlers read from the index, call
into `internal/analysis` or `internal/simulator`, and return JSON. No
business logic in HTTP handlers.

## Storage

One SQLite database, one table:

```sql
CREATE TABLE simulation_runs (
  id          INTEGER PRIMARY KEY,
  created_at  TEXT NOT NULL,
  created_by  TEXT,
  context     TEXT NOT NULL,   -- JSON-encoded SimContext
  result      TEXT NOT NULL,   -- JSON-encoded DecisionResult
  segment_id  TEXT,
  fqdn        TEXT,
  action      TEXT
);
```

Path: `${XDG_CONFIG_HOME}/painscaler/runs.db`. In Docker, `XDG_CONFIG_HOME`
resolves to `/data`, so the path is `/data/painscaler/runs.db` on the
`painscaler_data` named volume.

The schema uses `sqlc` for type-safe Go bindings. `internal/storage/`
contains `query.sql` and the generated `query.sql.go`.

`store.Open` runs an idempotent `migrate()` on startup. `migrate()` uses
`PRAGMA table_info` to check whether columns exist before issuing
`ALTER TABLE`. Adding columns is supported. Renaming is not.

## Codegen

| Tool | Input | Output |
|------|-------|--------|
| `go run ./apigen` | `//api:route` and `//api:header` comments in `internal/server/handlers.go` | `internal/server/routes.gen.go`, `internal/server/openapi.gen.json`, `frontend/src/shared/api/{models,api}.gen.ts` |
| `sqlc generate`   | `internal/storage/schema.sql` + `query.sql` | `internal/storage/{models,query.sql}.go` |

Both outputs are committed. Both regenerate manually when their inputs
change.

## Limitations

- SCIM group membership is not resolved. See
  [Roadmap](/reference/roadmap/).
- Cache refresh is reactive (request-driven). No proactive warmup or
  manual invalidation trigger. See [Roadmap](/reference/roadmap/).
