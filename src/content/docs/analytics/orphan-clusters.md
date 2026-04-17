---
title: Orphan clusters
description: Segments with no policy coverage, grouped by segment group.
---

Lists segments that no access policy references, grouped by their segment
group. Each cluster includes the connector groups still serving the orphan
segments.

## Endpoint

```http
GET /api/v1/analytics/orphan-clusters
```

## Response

```go
type OrphanCluster struct {
    SegmentGroupID   string
    SegmentGroupName string
    FullyOrphaned    bool        // true if every segment in the group is orphaned
    OrphanSegments   []NamedRef
    ConnectorGroups  []NamedRef  // groups still serving the orphans
}
```

Sorted by orphan count descending.

## Algorithm

1. Read `Index.OrphanSegments` (segments with no policy coverage, computed
   during index build).
2. Group entries by `seg.SegmentGroupID`.
3. For each cluster, walk server groups. Any server group listing one of the
   orphan segments contributes its `AppConnectorGroups` to the
   `ConnectorGroups` field.
4. Set `FullyOrphaned = true` when every segment in the segment group is
   orphaned (`len(orphans) == len(group.Applications)`).

## Use cases

- Identifying segment groups left behind by retired projects.
- Identifying connector groups serving only orphaned segments.
- Detecting stale staging environments.

## Edge cases

- A segment with `SegmentGroupID = ""` is excluded. The flat
  `OrphanReport[]` from `/api/v1/reports/orphans` lists those.
- Connector groups serving a mix of live and orphan segments still appear
  in `ConnectorGroups`. The structural load is real even when only part of
  it is wasted.
