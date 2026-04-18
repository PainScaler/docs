---
title: Roadmap
description: Planned and unimplemented capabilities, with the design intent for each.
sidebar:
  order: 99
---

Items below are not implemented in the current build. Each entry states the
gap, the constraint, and the intended approach.

## SCIM group membership

**Gap.** Reach reports name SCIM groups but cannot enumerate their members.
The simulator must take SCIM group IDs as an input rather than resolving them
from a user identity.

**Constraint.** The ZPA management API does not expose user-to-group
membership. The ZPA SCIM API does, but requires a per-IdP static bearer token
that must be issued and rotated separately for each IdP, which does not scale
operationally.

**Approach.** Direct integration with the upstream IdP (Microsoft Graph for
Entra ID, Okta API for Okta). One adapter per IdP, configured via env vars,
exposing `LookupUserGroups(userID) []scimGroupID`.

## Proactive fetcher cache refresh

**Current behavior.** The fetcher caches each ZPA resource with a TTL
(5 minutes for volatile resources, 1 hour for stable ones). When the TTL
expires, the next request triggers a refetch and the index is rebuilt
from the new data. On fetch failure, the cache returns the last-good data
along with the error. `Cache.Get` rechecks freshness after acquiring the
write lock so concurrent callers after expiry collapse to a single fetch.
SCIM attribute values are loaded lazily per `(idpID, headerID)` pair on
first access rather than eagerly enumerated at index build.

**Already closed at v1.0.0.**

- *Index warmup and background rebuild.* `Server.StartIndexWarmer` builds
  the index once at startup before the listener accepts traffic, then
  rebuilds every `warmerInterval` (4 minutes, less than `indexTTL` of 5
  minutes). Concurrent handler rebuilds coalesce via `singleflight`.
  Handlers never wait on a cold index in steady state.
- *Manual refresh.* `POST /api/v1/refresh` invalidates every fetcher
  cache, drops the built index, and forces one synchronous rebuild.
  Requires `Remote-User`; globally throttled to one allowed call per
  30 seconds.

**Residual gap — fetcher layer is still reactive.** The
`Cache[T]` refetch path fires only when a request arrives after TTL
expiry. The index warmer hides this for `indexTTL` worth of drift, but
the first rebuild that crosses a fetcher TTL still pays the SDK
round-trip (seconds, sometimes tens of seconds on a busy tenant).

**Approach.** A background goroutine inside `internal/fetcher` that
refreshes each `Cache[T]` slightly before its TTL expires, decoupled
from the index warmer so upstream latency never leaks into a handler
call.

## Browser-to-backend request correlation

**Gap.** Frontend telemetry events do not include the `X-Request-Id` of the
associated backend call. Correlation across logs is by `route` + `time`
only.

**Approach.** The browser fetch wrapper records `X-Request-Id` from the
response and attaches it to subsequent telemetry events fired from that
component tree.

## Per-route ACLs

**Gap.** Authelia decides whether a user may reach the application at all.
Once authenticated, every endpoint is open to every user.

**Approach.** Extend Authelia's policy file to add per-path rules. Add
forward-auth blocks per route group in the Caddyfile. No backend change
required.

## Wildcard collisions in domain overlap report

**Gap.** The domain overlap report lists literal duplicate domain entries
only. Implicit collisions where one segment declares `*.example.com` and
another declares `db.example.com` are not surfaced.

**Approach.** Augment the overlap pass with a wildcard-walk over every
domain entry across segments, emitting one `DomainOverlapDetail` per
implicit collision.
