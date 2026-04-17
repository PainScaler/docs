---
title: Flow graph and route matrix
description: Five-column ReactFlow graph and the underlying route enumeration.
---

The flow graph and the route matrix expose the same data in two views:
every reachable path from a SCIM group to an application segment.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/graph` | Filtered graph for the selection in the request body. |
| `GET`  | `/api/v1/routes` | Full route matrix across all SCIM groups and segments. |

## Graph structure

Five columns, left to right:

<pre class="mermaid">
flowchart LR
    A[SCIM groups] --> B[Access policies]
    B --> C[Connector groups]
    C --> D[Segment groups]
    D --> E[Segments]
</pre>

### Edge semantics

| Edge | Source data |
|------|-------------|
| SCIM group → policy   | Policy condition with operand `ObjectType = SCIM_GROUP` referencing the SCIM group ID on `RHS`. |
| Policy → connector group | Policy targets a server group bound to the connector group. |
| Policy → segment group | Policy condition with operand `ObjectType = APP_GROUP` referencing the segment group ID. |
| Policy → segment | Policy condition with operand `ObjectType = APP` referencing the segment ID directly. |
| Segment group → segment | ZPA's one-to-one constraint: a segment belongs to exactly one segment group. |

Selecting a node highlights every path the node participates in. The
request body of `POST /api/v1/graph` scopes the returned graph to one
starting node or one segment.

## Route matrix

`GET /api/v1/routes` returns the full enumeration:

```go
type RouteMatrix struct {
    Routes []Route
}

type Route struct {
    ScimGroupID       string
    ScimGroupName     string
    PolicyID          string
    PolicyName        string
    Action            string  // ALLOW | DENY | DEFAULT_DENY
    SegmentID         string
    SegmentName       string
    SegmentGroupID    string
    ConnectorGroupIDs []string
}
```

The UI renders the matrix as a filterable table. Selecting any cell value
filters the table to other routes that share the value.

## Common queries

| Question | Filter |
|----------|--------|
| Which SCIM groups can reach segment X? | Filter by `SegmentID`, read `ScimGroupName`. |
| Which segments can SCIM group Y reach? | Filter by `ScimGroupID`, read `SegmentName`. |
| Which policies cover only one route? | Sort by `PolicyID`, count routes per policy, inspect single-row policies. |

## Implementation

`internal/analysis/flow.go` builds the route set by traversing the inverted
indexes from the index layer. No SDK calls. Cost is one map walk per
dimension.
