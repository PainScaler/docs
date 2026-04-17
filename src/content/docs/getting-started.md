---
title: Getting started
description: Prerequisites, environment variables, and the development workflow.
---

PainScaler runs as two components:

| Component | Description |
|-----------|-------------|
| **Backend** | Go binary on port `8080`. Calls ZPA via `zscaler-sdk-go`, builds an in-memory index, exposes a JSON API. |
| **Frontend** | React + Vite + PatternFly v6 SPA. Production: served as a static bundle. Development: Vite dev server proxies `/api` to the backend. |

Both components can run on the same host (single binary plus static bundle)
or as two containers behind a reverse proxy. The Docker stack in `deploy/`
covers the second deployment with auth integrated. See
[Docker compose](/deployment/docker-compose/).

## Prerequisites

| Component | Version |
|-----------|---------|
| Go    | 1.25 or newer |
| Node  | 22 LTS |
| Yarn  | 1.x (classic) |
| ZPA tenant | Read-only API client |

ZPA OAuth client credentials are read from environment variables. See
[Environment variables](/reference/env-vars/).

The backend issues read-only ZPA API calls. Use a read-only API client.

## Native run

```bash
git clone --recurse-submodules git@github.com:PainScaler/painscaler.git
cd painscaler
cp example.env .env
$EDITOR .env   # fill in ZPA_* values

source .env
go run ./cmd/painscaler
```

In a second terminal:

```bash
cd frontend
yarn install
yarn dev   # http://localhost:5173, proxies /api to :8080
```

Open `http://localhost:5173`.

## Docker run

```bash
cd deploy
make init                  # generate .env + secrets + render configs
$EDITOR .env               # fill ZPA_* values
make build
make up
make show-admin            # generated admin password
make ca                    # extract Caddy root CA
```

Trust `painscaler-ca.crt` in the browser, add `painscaler.lan` and
`auth.lan` to `/etc/hosts`, then visit `https://painscaler.lan`.

Full deploy walkthrough: [Docker compose](/deployment/docker-compose/).

## Verify

Once the index has built (a few seconds on a small tenant), the following
features are available:

- [Search and reachability](/features/search/)
- [Policy simulator](/features/simulator/)
- [Flow graph and route matrix](/features/graph/)
- [Analytics reports](/analytics/)
