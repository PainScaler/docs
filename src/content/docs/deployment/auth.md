---
title: Auth and identity
description: Caddy forward-auth, Authelia, and the Remote-User trust model.
sidebar:
  order: 3
---

The Docker stack uses Caddy and Authelia for authentication. The backend is
auth-agnostic: it reads identity from `Remote-*` headers and trusts them
only when the direct peer is in `TRUSTED_PROXIES`.

## Request flow

<pre class="mermaid">
sequenceDiagram
    participant B as Browser
    participant C as Caddy
    participant A as Authelia
    participant W as painscaler-web (nginx)
    participant API as painscaler-api

    B->>C: GET https://painscaler.lan/...
    C->>A: forward_auth (session check)
    alt Authenticated
        A-->>C: 200 + Remote-User, Remote-Email, Remote-Groups, Remote-Name
        C->>W: Forward request with Remote-* headers
        W->>API: Forward request with Remote-* headers
        API-->>W: Response
        W-->>C: Response
        C-->>B: Response
    else Unauthenticated
        A-->>C: 401
        C-->>B: 302 -> https://auth.lan
    end
</pre>

## Backend trust model

The backend trusts `Remote-*` headers only when the direct peer matches
`TRUSTED_PROXIES`:

```
TRUSTED_PROXIES=172.16.0.0/12,10.0.0.0/8
```

The default covers Docker bridge networks (172.16/12) and standard private
ranges (10/8). Headers from peers outside the CIDR list are deleted in
middleware before any handler runs.

Implementation: `internal/server/server.go` — `stripUntrustedAuthHeaders`
runs before `RequestID` and `AccessLog`. The access log records the
post-strip identity.

`TRUSTED_PROXIES` accepts comma-separated bare IPs (auto-promoted to
`/32` or `/128`) or CIDRs.

## Header contract

| Header | Purpose | Used by |
|--------|---------|---------|
| `Remote-User`   | Stable user ID. | `RunSimulation` (audit), `GetMe`, access log `user` field. |
| `Remote-Email`  | Email. | `GetMe`. |
| `Remote-Groups` | Comma-separated group list. | `GetMe` (display only). |
| `Remote-Name`   | Display name. | `GetMe`. |

Authelia configures these via its forward-auth response headers. Any
forward-auth provider that sets the same four headers (Authentik,
oauth2-proxy, Pomerium) is compatible.

## Per-handler binding

`apigen` exposes a `//api:header` directive. Handlers that need identity
declare it explicitly:

```go
//api:route POST /api/v1/simulation/run
//api:header Remote-User={user}
func (s *Server) RunSimulation(user string, simCtx simulator.SimContext) (*simulator.DecisionResult, error) {
    // user is empty string when no Remote-User header is present
}
```

The TypeScript client never sees `user` as a parameter. `apigen` strips
header-source parameters from the generated frontend code.

## Audit attribution

When `RunSimulation` succeeds, the resulting row in `simulation_runs` has
`created_by = Remote-User`. The simulation history visible in the UI's
Scans tab is attributed accordingly. `Remote-User` is empty for native
runs without a forward-auth proxy — those rows have no author.

## Per-route ACLs

Authelia decides whether a user may reach the application at all. Once
authenticated, every endpoint is reachable by every authenticated user.
Per-feature gating is not implemented. See [Roadmap](/reference/roadmap/).

## Replacing Authelia

Integration surface for any forward-auth provider:

1. Remove the Authelia container.
2. Replace the `forward_auth` block in `Caddyfile` with the new provider's
   configuration.
3. Configure the provider to set `Remote-User`, `Remote-Email`,
   `Remote-Groups`, `Remote-Name`.
4. Keep `TRUSTED_PROXIES` accurate for the new network topology.
