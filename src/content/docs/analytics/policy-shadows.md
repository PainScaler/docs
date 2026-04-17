---
title: Policy shadows
description: Policy pairs covering the same (SCIM group, segment) pair.
---

Identifies pairs of policies whose `(SCIM group, segment)` coverage sets
intersect. A pair is a **shadow** when both policies share the same action,
and a **conflict** when actions differ.

## Endpoint

```http
GET /api/v1/analytics/policy-shadows
```

## Response

```go
type PolicyShadowReport struct {
    PolicyA          PolicySummary
    PolicyB          PolicySummary  // higher RuleOrder, the shadowed one
    SharedScimGroups []NamedRef
    SharedSegments   []NamedRef
    Verdict          string         // "shadow" or "conflict"
}

type PolicySummary struct {
    ID        string
    Name      string
    Action    string  // ALLOW | DENY | DEFAULT_DENY
    RuleOrder int
}
```

`PolicyA.RuleOrder < PolicyB.RuleOrder`. PolicyA fires first; PolicyB is
reached only when PolicyA's conditions do not match.

## Verdict semantics

| `PolicyA.Action` | `PolicyB.Action` | Verdict  |
|------------------|------------------|----------|
| `ALLOW`          | `ALLOW`          | shadow   |
| `DENY`   | `DENY`   | shadow   |
| `ALLOW`          | `DENY`   | conflict |
| `DENY`   | `ALLOW`          | conflict |

## Algorithm

1. For each policy, build the set of `(scimGroupID, segmentID)` pairs it
   covers.
2. Compare every pair of policies. If their pair-sets intersect, emit a
   report.

Comparison is quadratic in policy count. At 500 policies this is 125,000
comparisons, executed per request.

## Use cases

- Cleanup of redundant rules where a shadow exists.
- Audit of conflicting rules where two policies disagree on the action for
  the same `(SCIM group, segment)` pair.
- Refactor planning when many overlaps cluster around a small set of SCIM
  groups or segment groups.
