---
title: Blast radius
description: Impact set of a connector group or server group.
---

Returns the full dependency closure of a connector group or server group:
every policy that references it, every SCIM group whose access flows through
it, every segment served by it.

## Endpoint

```http
GET /api/v1/analytics/blast-radius?id={id}&type={connector_group|server_group}
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id`   | string | yes | Target resource ID |
| `type` | enum   | yes | `connector_group` or `server_group` |

## Response

```go
type BlastRadiusReport struct {
    TargetID   string
    TargetName string
    TargetType string     // "connector_group" or "server_group"
    Policies   []NamedRef // policies that reference this target
    ScimGroups []NamedRef // SCIM groups whose access flows through it
    Segments   []NamedRef // segments served by this target
}
```

## Algorithm

For `type=connector_group`:

1. Look up `ConnectorGroupToPolicies[id]`.
2. For each policy, walk `PolicyToScimGroups` for SCIM groups and
   `policySegmentIDs(pol)` for segments.
3. Deduplicate and sort.

For `type=server_group`:

1. Resolve the server group's `AppConnectorGroups[]`.
2. Run the connector-group algorithm above for each.

## Use cases

- Pre-change impact analysis before draining a connector for maintenance.
- Capacity planning for connector groups serving large policy or segment counts.
- Audit of critical paths — verifying that high-privilege SCIM groups do not
  depend on connector groups intended for limited or temporary use.

## Edge cases

- Targets without a resolvable name return `Name = ID`.
- An empty result for a known target ID indicates that no policies reference
  the target.
