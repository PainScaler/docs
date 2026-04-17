---
title: ZPA data model quirks
description: Reference for ZPA API shapes that are not documented or that diverge from the SDK type signatures.
---

Notes on ZPA management API shapes that affect any code calling the SDK
directly. Each entry states the field, its actual encoding, and the
behavior the indexer and simulator depend on.

## Operand value field

The single source of truth for an operand's value is the `RHS` string field.

This applies across every operand `ObjectType` (`SCIM_GROUP`, `SCIM`,
`APP`, `APP_GROUP`, `CLIENT_TYPE`, `PLATFORM`, `TRUSTED_NETWORK`, ...).

The struct also exposes `Values []string`. This field is unused — it is
always `nil` in practice. The SDK type spans an old and a new operand
schema. Only the new shape is in use.

## Rule ordering

`RuleOrder` is the field that drives evaluation order. Type: **string**.
Parse with `strconv.Atoi`, sort ascending.

`Priority` exists on the struct but is not consulted by the simulator
because no observed evaluation context uses it.

## Disabled flag

`Disabled` is a string. `"0"` means enabled. `"1"` means disabled. Any
other value indicates upstream corruption.

## SCIM operand ID types

SCIM group IDs are stored as `int64` in the index
(`Index.ScimGroups map[int64]*ScimGroup`). On the wire and in policy
operands they appear as strings. Conversion happens at the boundary;
parse failures surface as errors rather than silent zero values.

SCIM attribute headers and values are strings throughout. They are not
unified with the group ID type.

## Segment to segment-group cardinality

A given application segment belongs to exactly one segment group. ZPA
enforces this. `SegmentToGroup` is a `map[string]string`, not
`map[string][]string`.

A segment observed in two segment groups simultaneously indicates upstream
corruption.

## Domain matching

Each segment declares an array of domain entries. Each entry is one of:

- An exact hostname (`db.prod.example.com`).
- A wildcard (`*.prod.example.com`) that matches any single-label or
  multi-label prefix.

Reachability resolution walks parents bottom-up: exact → `*.parent` →
`*.grandparent` → `*.tld`. First match wins.

Multiple segments may declare the same domain or wildcard. This case is
the basis of the [domain overlap report](/analytics/domain-overlaps/).

## Empty condition list

A policy rule with zero conditions matches every user. ZPA exhibits this
behavior. The simulator emits a warning because the case is rarely
intentional.

## Unknown `ObjectType`

The SDK exposes a non-closed set of operand object types. New types appear
in API responses without prior schema changes. The simulator treats
unknown types as skipped, surfacing the type via `SkipReason`. No
semantic guess is made.

## Authentication

ZPA uses ZIdentity (ZID) OAuth2.

## Limitations of the ZPA management API

The following data is not exposed by the management API and is therefore
not reflected in the index:

- **SCIM group membership.** The management API does not return the
  groups a user belongs to. The SCIM API requires per-IdP static bearer
  tokens. See [Roadmap](/reference/roadmap/) for the planned IdP-direct
  approach.
- **Per-rule hit counts.** The management API does not expose rule
  evaluation frequency. Runtime data is available only via LSS.
- **Backlinks.** The API exposes forward edges only. Every
  `*ToPolicies` map in the index is computed locally, not fetched.
