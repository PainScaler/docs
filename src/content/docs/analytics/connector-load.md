---
title: Connector load
description: Per-connector-group counts of policies, segment groups, segments, and SCIM groups served.
---

One row per connector group. Each row lists the count of distinct policies,
segment groups, segments, and SCIM groups that depend on the connector
group. Sorted by segment count descending.

## Endpoint

```http
GET /api/v1/analytics/connector-load
```

## Response

```go
type ConnectorLoadEntry struct {
    ConnectorGroupID   string
    ConnectorGroupName string
    PolicyCount        int  // distinct policies referencing this connector group
    SegmentGroupCount  int  // distinct segment groups touched by those policies
    SegmentCount       int  // distinct segments touched by those policies
    ScimGroupCount     int  // distinct SCIM groups granted access through those policies
}
```

## Algorithm

For each connector group:

1. Read the policy list from `ConnectorGroupToPolicies`.
2. For each policy, accumulate its segments (via the policy's segment scope)
   and SCIM groups (via `PolicyToScimGroups`).
3. Count distinct entries in each set.

## Use cases

- Capacity planning by ranking connector groups by structural load.
- Identifying connector groups with `PolicyCount = 0` for retirement review.
- Combine with [blast radius](/analytics/blast-radius/) to map structural
  load to specific affected SCIM groups and segments.

## Limitations

- The reported load is **structural**, not runtime. The ZPA management API
  does not expose per-rule hit counts. Runtime traffic data requires LSS.
- A policy targeting a segment group is counted as touching every segment
  in that group, regardless of which segments have active server-group
  bindings.
