---
title: Overview
description: Analytics reports computed from the in-memory index.
sidebar:
  order: 0
---

The analytics layer exposes six reports. Each report is computed from the
in-memory index on every request. No SDK calls occur after the initial
fetch.

## Reports

| Report | Endpoint | Purpose |
|--------|----------|---------|
| [Blast radius](/analytics/blast-radius/)         | `GET /api/v1/analytics/blast-radius?id=&type=` | Impact set of a connector group or server group. |
| [Policy shadows](/analytics/policy-shadows/)     | `GET /api/v1/analytics/policy-shadows`         | Policy pairs covering the same `(SCIM group, segment)` pair. |
| [Orphan clusters](/analytics/orphan-clusters/)   | `GET /api/v1/analytics/orphan-clusters`        | Segments with no policy coverage, grouped by segment group. |
| [Domain overlaps](/analytics/domain-overlaps/)   | `GET /api/v1/analytics/domain-overlaps`        | Hostnames that appear in more than one segment. |
| [Connector load](/analytics/connector-load/)     | `GET /api/v1/analytics/connector-load`         | Per-connector-group counts of policies, segments, and SCIM groups served. |
| [SCIM reach](/analytics/scim-reach/)             | `GET /api/v1/analytics/scim-reach`             | Per-SCIM-group counts of policies, segment groups, and segments granted. |

## Common shape

Most reports use `NamedRef`:

```go
type NamedRef struct {
    ID   string `json:"id"`
    Name string `json:"name"`
}
```

When a referenced name cannot be resolved (deleted or stale reference),
`Name` falls back to `ID`. Entries are never dropped silently.

## Refresh model

Reports run against the current index. The index is rebuilt on every
request from the per-resource caches in `internal/fetcher`. Each resource
has its own TTL (5 minutes for volatile resources, 1 hour for stable
ones). Cache misses trigger an SDK refetch on the request that hits the
miss; concurrent callers after expiry collapse to one fetch via
double-checked locking. See [Architecture](/reference/architecture/) for
layer detail and [Roadmap](/reference/roadmap/) for proactive refresh.
