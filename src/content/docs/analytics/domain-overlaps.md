---
title: Domain overlaps
description: Hostnames that appear in more than one segment, with action-conflict detection.
---

Lists hostnames that appear in two or more application segments. For each
hostname, lists the segments and the policies attached to them, and flags
overlaps where the policy actions differ.

## Endpoint

```http
GET /api/v1/analytics/domain-overlaps
```

## Response

```go
type DomainOverlapDetail struct {
    Domain      string
    Segments    []DomainSegmentDetail
    HasConflict bool                  // true if at least two policies disagree on Action
}

type DomainSegmentDetail struct {
    ID       string
    Name     string
    Policies []NamedRef // policies attached to this segment
}
```

Sorted: conflicts first, then alphabetically by domain.

## Algorithm

1. Walk `Index.OverlappingDomains` (built during index time as "domains
   that appear in more than one segment").
2. For each entry, list the segments and the policies attached to each.
3. Collect every distinct `pol.Action` across all the policies. If the set
   has more than one value, set `HasConflict = true`.

## Wildcard handling

Only literal duplicate domain entries are listed. Implicit wildcard
collisions — for example `*.example.com` in segment A and
`db.example.com` in segment B — are not surfaced by this report. See
[Roadmap](/reference/roadmap/).

For wildcard-aware lookup of a single hostname, use the
[reachability query](/features/search/).

## Use cases

- Conflict triage where `HasConflict = true`.
- Drift detection across teams adding the same domain to different
  segments without coordination.
- Resolving overlaps before running shadow analysis.
