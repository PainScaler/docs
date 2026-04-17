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

## Proactive cache refresh

**Current behavior.** The fetcher caches each ZPA resource with a TTL
(5 minutes for volatile resources, 1 hour for stable ones). When the TTL
expires, the next request triggers a refetch and the index is rebuilt
from the new data. On fetch failure, the cache returns the last-good data
along with the error. `Cache.Get`
(`internal/fetcher/cache.go:62`) rechecks freshness after acquiring the
write lock so concurrent callers after expiry collapse to a single
fetch. SCIM attribute values are loaded lazily per `(idpID, headerID)`
pair on first access rather than eagerly enumerated at index build.

**Gap 1 — reactive only.** Refresh fires only when a request arrives
after expiry. The first request after each expiry pays the full SDK
round-trip latency (seconds, sometimes tens of seconds on a busy tenant).
A daemon would warm the cache in the background so user requests never
pay that latency.

**Gap 2 — no eager warmup at startup.** The first request after process
start hits an empty cache. Container restarts impose the same cold-start
cost on whichever request lands first.

**Gap 3 — no manual refresh trigger.** When a change in ZPA needs
immediate visibility, the only options are "wait up to TTL" or restart
the process.

**Approach.** A background goroutine refreshes each cached resource
slightly before its TTL expires. An optional `POST /api/v1/refresh`
invalidates the cache on demand. Eager warmup at startup populates
every cache before the listener accepts connections.

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
