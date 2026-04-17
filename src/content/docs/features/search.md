---
title: Search and reachability
description: Substring search across every indexed resource, plus hostname-targeted reachability lookup.
---

Two endpoints share the same in-memory index: a global substring search and
a hostname-targeted reachability query.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/search?q={term}` | Substring search across every indexed resource type. |
| `GET` | `/api/v1/reachability?q={hostname}` | Segments and policies that grant reachability to a hostname. |
| `GET` | `/api/v1/segment/{id}/policies` | Policy coverage for a single segment ID. |

## Global search

`GET /api/v1/search?q={term}` matches case-insensitive substrings across:

- Application segments (name, description, domains)
- Segment groups (name, description)
- Access policies (name, description)
- SCIM groups (name)
- Connector groups (name, description)
- Server groups (name, description)

Each result carries the resource type so the UI can group and link.

```go
type SearchResult struct {
    Type        string  // "segment" | "segment_group" | "policy" | ...
    ID          string
    Name        string
    Description string
    MatchField  string  // which field hit
}
```

## Reachability

`GET /api/v1/reachability?q={hostname}` resolves a hostname to every segment
that covers it, with the policies that grant access.

### Algorithm

1. Lookup the exact hostname in `DomainToSegments`. Return the matches.
2. If no exact match, walk parent wildcards bottom-up:
   `db.prod.example.com` → `*.prod.example.com` → `*.example.com` → `*.com`.
   Return the first wildcard match.

### Response

```go
type ReachabilityResult struct {
    Hostname string
    Matches  []SegmentReachability
}

type SegmentReachability struct {
    SegmentID    string
    SegmentName  string
    MatchedDomain string  // the actual entry that matched
    IsWildcard   bool
    Policies     []PolicyCoverage
}
```

`PolicyCoverage` is the same shape returned by
`/api/v1/segment/{id}/policies`: the policies that grant access to the
segment, with SCIM group references resolved by name where possible.

## Policy coverage for a segment

`GET /api/v1/segment/{id}/policies` returns every policy that touches a
known segment ID, directly or via a segment group. Each result is enriched
with:

- The action (`ALLOW` / `DENY` / `DEFAULT_DENY`)
- Rule order
- Whether the policy targets the segment directly or through a segment group
- The SCIM groups the policy applies to

This endpoint backs the segment detail page in the UI and the
[route matrix](/features/graph/).
