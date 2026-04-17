---
title: SCIM reach
description: Per-SCIM-group counts of policies, segment groups, and segments granted access.
---

One row per SCIM group. Each row lists the count of distinct policies,
segment groups, and segments granted to the group. Sorted by segment count
descending.

## Endpoint

```http
GET /api/v1/analytics/scim-reach
```

## Response

```go
type ScimReachEntry struct {
    ScimGroupID       string
    ScimGroupName     string
    PolicyCount       int
    SegmentGroupCount int
    SegmentCount      int
}
```

## Algorithm

1. Invert `PolicyToScimGroups` to obtain `scimGroupID -> []policyID`.
2. For each SCIM group, walk its policies and accumulate distinct segments
   and segment groups.
3. Count distinct entries.

## Use cases

- Least-privilege audits.
- Group-consolidation analysis where two SCIM groups exhibit identical
  reach counts.
- Pre-deletion impact review for a SCIM group, combined with
  [policy shadows](/analytics/policy-shadows/) to identify policies that
  would still cover the segments through other groups.

## Limitations

- Group membership is not resolved. Reach is reported as "any member of
  this group can reach this much." See [Roadmap](/reference/roadmap/) for
  IdP-direct membership integration.
- Counts reflect grants only. A grant via one policy can be overridden by
  a higher-priority deny in another policy. To verify the effective
  decision for a given user context, use the
  [simulator](/features/simulator/).
