---
title: Demo mode
description: Serve a scrubbed JSON snapshot instead of a real ZPA tenant.
sidebar:
  order: 4
---

Demo mode swaps the ZPA fetch path for a JSON-encoded
`fetcher.Snapshot` loaded from disk. No ZPA credentials are consulted, no
outbound calls are made, and every API route that normally reads from
ZPA reads from the seeded snapshot instead. Used for the public demo
deployment and for local exploration without a tenant.

## Enabling demo mode

Set `PAINSCALER_DEMO_SEED` to the absolute path of a snapshot JSON file:

```bash
PAINSCALER_DEMO_SEED=/srv/painscaler/snapshot.json go run ./cmd/painscaler
```

At startup the backend reads the file, pre-populates every `Cache[T]`
via `fetcher.SeedDemoCache`, and skips the SDK. `GET /api/v1/about`
reports:

```json
{ "version": "1.0.0", "commit": "...", "date": "...", "demo": true }
```

The frontend reads the `demo` flag and surfaces a banner.

## Producing a snapshot

`cmd/seedgen` emits a deterministic synthetic `fetcher.Snapshot` with
stable string IDs so references line up without bookkeeping:

```bash
go run ./cmd/seedgen -out snapshot.json
```

Output is shape-compatible with a live ZPA fetch: same Go types, same
inverted-index build path, same simulator behaviour. The default seed
produces a small synthetic tenant (SCIM groups, policies, segments,
connector groups, IdPs) sufficient to exercise every analytics report
and the simulator FSM.

Omit `-out` to write to stdout.

## Operational notes

- Demo mode coexists with the normal auth stack. `Remote-User` still
  attributes simulation runs; Authelia (or any replacement forward-auth
  provider) still gates access to the UI.
- The fetcher TTLs are set to 100 years in demo mode — the caches are
  seeded once at startup and never refetched. `POST /api/v1/refresh`
  rebuilds the index from the seeded data but does not re-read the
  snapshot file; `InvalidateAll` is a no-op in demo mode so the seeded
  data survives. To load an updated snapshot, restart the process.
- Simulation history is still persisted to the SQLite database under
  `${XDG_CONFIG_HOME}/painscaler/runs.db`, unchanged from live mode.
- The snapshot file is the only trust boundary. Treat it as sensitive
  when built from a real tenant.
