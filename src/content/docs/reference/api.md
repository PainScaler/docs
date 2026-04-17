---
title: HTTP API
description: Backend route reference. Generated from Go handlers via apigen.
---

The backend exposes 37 JSON endpoints under `/api/v1`. Routes are generated
from Go handler annotations in `internal/server/handlers.go`. The canonical
spec is `internal/server/openapi.gen.json`. The typed TypeScript client is
`frontend/src/shared/api/api.gen.ts`. Generated files are not hand-edited.

## Route registration

Each handler in `internal/server/handlers.go` carries a comment marker:

```go
//api:route POST /api/v1/simulation/run
//api:header Remote-User={user}
func (s *Server) RunSimulation(user string, simCtx simulator.SimContext) (*simulator.DecisionResult, error) { ... }
```

`go run ./apigen` parses these markers and generates:

| Output | Purpose |
|--------|---------|
| `internal/server/routes.gen.go`        | Gin route registration. |
| `internal/server/openapi.gen.json`     | OpenAPI 3.1 document. |
| `frontend/src/shared/api/models.gen.ts` | TypeScript types for every Go type used. |
| `frontend/src/shared/api/api.gen.ts`    | Typed fetch wrappers. |

Header-source parameters (`Remote-User`, etc.) are stripped from the
TypeScript client. The proxy sets them. Trust model: see
[auth](/deployment/auth/).

## Routes

### Index and search

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/v1/index` | Full in-memory index snapshot. |
| GET | `/api/v1/search?q=...` | `SearchResult[]` across every resource type. |
| GET | `/api/v1/segment/{segmentID}/policies` | `PolicyCoverage[]` for one segment. |
| GET | `/api/v1/reachability?q=hostname` | `ReachabilityResult` (segments + policies covering the hostname). |

### Reports (legacy quick views)

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/v1/reports/orphans`  | `OrphanReport[]` (segments without policy coverage). |
| GET | `/api/v1/reports/overlaps` | `OverlapReport[]` (domains in multiple segments). |

### Simulator

| Method | Path | Returns |
|--------|------|---------|
| POST   | `/api/v1/simulation/run`   | Runs the FSM, persists when valid, returns `DecisionResult`. |
| GET    | `/api/v1/simulation`       | `SimulationRun[]` paginated list. |
| GET    | `/api/v1/simulation/{id}`  | One historical run. |
| DELETE | `/api/v1/simulation/{id}`  | Removes one run. |
| GET    | `/api/v1/simulation/count` | Total run count. |

### Identity and meta

| Method | Path | Returns |
|--------|------|---------|
| GET  | `/api/v1/me`        | `Identity` from `Remote-*` headers (post-strip). |
| GET  | `/api/v1/about`     | Build version, commit, date. |
| POST | `/api/v1/telemetry` | Browser telemetry batch (page views + errors). |
| GET  | `/metrics`          | Prometheus metrics (in-cluster only). |

### Flow graph

| Method | Path | Returns |
|--------|------|---------|
| POST | `/api/v1/graph`  | `FlowGraph` filtered by the body's selection. |
| GET  | `/api/v1/routes` | Full `RouteMatrix` (every reachable user-group to segment path). |

### Analytics

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/v1/analytics/blast-radius?id=...&type=...` | `BlastRadiusReport` |
| GET | `/api/v1/analytics/policy-shadows`     | `PolicyShadowReport[]` |
| GET | `/api/v1/analytics/orphan-clusters`    | `OrphanCluster[]` (orphans grouped by segment group) |
| GET | `/api/v1/analytics/domain-overlaps`    | `DomainOverlapDetail[]` |
| GET | `/api/v1/analytics/connector-load`     | `ConnectorLoadEntry[]` |
| GET | `/api/v1/analytics/scim-reach`         | `ScimReachEntry[]` |

### Raw ZPA passthrough

Returns the resource list as the SDK delivers it. Use cases: debugging,
custom tooling on top of the index.

| Method | Path |
|--------|------|
| GET | `/api/v1/zpa/segments` |
| GET | `/api/v1/zpa/segment-groups` |
| GET | `/api/v1/zpa/access-policies` |
| GET | `/api/v1/zpa/app-connectors` |
| GET | `/api/v1/zpa/app-connector-groups` |
| GET | `/api/v1/zpa/server-groups` |
| GET | `/api/v1/zpa/scim-groups` |
| GET | `/api/v1/zpa/scim-attribute-headers` |
| GET | `/api/v1/zpa/scim-attribute-values?idp_id=...&header_id=...` |
| GET | `/api/v1/zpa/idp-controllers` |
| GET | `/api/v1/zpa/trusted-networks` |
| GET | `/api/v1/zpa/posture-profiles` |
| GET | `/api/v1/zpa/certificates` |
| GET | `/api/v1/zpa/client-types` |
| GET | `/api/v1/zpa/platforms` |

## OpenAPI

The full spec is `internal/server/openapi.gen.json`. Compatible with
Swagger UI, Insomnia, and standard OpenAPI client generators. Regenerated
on every `go run ./apigen` and committed.

## Headers

| Header | Set by | Used by |
|--------|--------|---------|
| `X-Request-Id` | Server middleware (UUID per request, echoed in response). | Every log line and every response. |
| `Remote-User`, `Remote-Email`, `Remote-Groups`, `Remote-Name` | Forward-auth proxy (Authelia via Caddy). | `RunSimulation`, `GetMe`, access log `user` field. |

`Remote-*` headers from untrusted peers are stripped in middleware before
any handler runs.
