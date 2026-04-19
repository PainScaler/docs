---
title: Policy simulator
description: FSM-based ZPA access policy evaluator. Returns the verdict, the matched rule, and the per-rule trace.
---

The simulator evaluates a single ZPA access decision against the indexed
policy set. It returns the verdict, the matching rule (if any), and the
per-rule trace including every condition the FSM evaluated.

## Endpoint

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/simulation/run`     | Run one evaluation. Persists when the verdict is not `INVALID_CONTEXT`. |
| `POST` | `/api/v1/simulation/compare` | What-if: run the same context against both the real policy set and an overlay that splices in a synthetic rule. |

The full simulation CRUD set is documented in the
[HTTP API reference](/reference/api/).

## State machine

<pre class="mermaid">
stateDiagram-v2
    [*] --> validate_context
    validate_context --> resolve_segment: valid
    validate_context --> decided: INVALID_CONTEXT
    resolve_segment --> sort_rules: segment found
    resolve_segment --> decided: NO_SEGMENT
    sort_rules --> next_rule
    next_rule --> eval_conditions: rules remaining
    next_rule --> decided: no rules left (DEFAULT_DENY)
    eval_conditions --> decided: matched (rule.Action)
    eval_conditions --> next_rule: no match
    decided --> [*]
</pre>

States are constants in `internal/simulator/states.go`. Implementation uses
`looplab/fsm`. Adding a new state requires a transition entry plus a
callback; the dispatcher does not branch on state strings.

## Validation rules at `validate_context`

The context is rejected when any of the following hold:

- `ClientType` is empty.
- Both `SegmentID` and `FQDN` are set.
- Neither `SegmentID` nor `FQDN` is set.

## Segment resolution at `resolve_segment`

- `SegmentID` set: direct lookup in `Index.Segments`.
- `FQDN` set: exact-match lookup in `DomainToSegments`, then wildcard
  parent walk (`db.prod.example.com` → `*.prod.example.com` →
  `*.example.com` → `*.com`). First match wins.

## Rule ordering at `sort_rules`

Rules are sorted descending by `Priority` (parsed via `strconv.Atoi`).
Highest priority evaluates first. Rules with `Disabled = "1"` are dropped
here.

## Request body — `SimContext`

```go
type SimContext struct {
    ScimGroupIDs    []string          // SCIM group IDs the user belongs to
    ScimAttrs       map[string]string // attrDefID -> value
    SegmentID       string            // either this...
    SegmentGroupID  string            // ...or covered via group
    FQDN            string            // ...or this hostname
    ClientType      string            // required
    TrustedNetwork  string            // optional
    Platform        string            // optional
}
```

`SegmentID` and `FQDN` are mutually exclusive.

## Response body — `DecisionResult`

```go
type DecisionResult struct {
    Action      string         // ALLOW | DENY | DEFAULT_DENY | NO_SEGMENT | INVALID_CONTEXT
    MatchedRule *PolicyRule    // populated when Action is ALLOW or DENY
    Trace       []RuleTrace    // every rule the FSM looked at
    Warnings    []string       // soft issues worth flagging
}
```

`Trace` entries contain:

- `RuleID`, `RuleName`, `Priority`, `Action`
- `Matched` — whether this rule decided the case
- `SkipReason` — populated when the rule was skipped
- `Conditions[]` — per-condition results, each with operands, the operator
  used to combine them, the negation flag, and the boolean outcome

## Verdict semantics

| `Action`           | Meaning |
|--------------------|---------|
| `ALLOW`            | A policy matched with `Action = ALLOW`. |
| `DENY`             | A policy matched with `Action = DENY`. |
| `DEFAULT_DENY`     | No policy matched. ZPA's default-deny applies. |
| `NO_SEGMENT`       | Segment ID does not exist, or FQDN matches no indexed domain (exact or wildcard). |
| `INVALID_CONTEXT`  | `SimContext` failed validation before the FSM started. |

## Locked-in behavior

| Concern             | Behavior |
|---------------------|----------|
| Operand value       | `RHS` holds the value across every operand `ObjectType`. `Values []string` is unused. |
| Rule order          | `Priority` (string), parsed via `strconv.Atoi`. Sort descending — highest priority evaluates first. `RuleOrder` is ignored. |
| Disabled flag       | String encoding. `"0"` = enabled, `"1"` = disabled. |
| Unknown `ObjectType`| Skipped with a `SkipReason` warning. No semantic guess. |
| Empty conditions    | Match every user. ZPA exhibits this behavior. Surfaced as a warning. |
| Tie-breaking        | First match wins after sorting by `Priority`. No further tie-break. |

## Persistence

When `Action` is anything other than `INVALID_CONTEXT`, the run is persisted
to `simulation_runs` in SQLite. `created_by` is populated from the
`Remote-User` header (empty when running natively without a proxy).

CRUD endpoints: see [HTTP API reference](/reference/api/).

## Compare (what-if)

`POST /api/v1/simulation/compare` runs the same `SimContext` twice: once
against the indexed policy set, once against an overlay that splices in a
synthetic rule built from the request. Both verdicts come back in one
response so the UI can diff them.

```go
type CompareRequest struct {
    Context       simulator.SimContext
    VirtualPolicy VirtualPolicyInput
}

type VirtualPolicyInput struct {
    Name            string
    Action          string   // ALLOW | DENY
    Priority        string   // parsed via strconv.Atoi, same rules as real policies
    ScimGroupIDs    []string
    SegmentIDs      []string
    SegmentGroupIDs []string
}

type CompareResult struct {
    Baseline    *simulator.DecisionResult
    WithVirtual *simulator.DecisionResult
    VirtualRule *policysetcontrollerv2.PolicyRuleResource
}
```

The overlay is a shallow-cloned index with the synthetic rule inserted
at `Priority`. The real policy list is untouched. Compare runs are not
persisted.

## Tests

`internal/simulator/simulator_test.go` covers FSM transitions and the
condition evaluator end-to-end (~25 cases).

