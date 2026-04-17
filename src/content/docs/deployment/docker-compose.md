---
title: Docker compose
description: Self-hosted four-container stack with Caddy, Authelia, the Go API, and an nginx-served static frontend.
sidebar:
  order: 1
---

The `deploy/` directory ships a four-container stack:

| Container | Role |
|-----------|------|
| `caddy`           | TLS termination via `local_certs`, forward-auth integration with Authelia. |
| `painscaler-api`  | Go binary, distroless image, port 8080 internal only. |
| `painscaler-web`  | nginx serving the built React SPA. |
| `authelia`        | File-based auth with TOTP MFA. |

Caddy is the only container with published ports. All other containers run
on the `painscaler` bridge network and are reached through Caddy.

## Prerequisites

- Docker and Docker Compose v2.
- `make`.
- Local DNS or `/etc/hosts` entries for `painscaler.lan` and `auth.lan`.

## Quickstart

```bash
cd deploy
make init          # generate .env, secrets, render templated configs
$EDITOR .env       # fill ZPA_CLIENT_ID, ZPA_CLIENT_SECRET, ZPA_CUSTOMER_ID, ZPA_VANITY, ZPA_IDP
make build
make up
make show-admin    # print the generated admin password
make ca            # extract Caddy root CA -> ./painscaler-ca.crt
```

Add to `/etc/hosts` on every machine that should reach the stack:

```
<docker-host-ip>  painscaler.lan auth.lan
```

Trust `painscaler-ca.crt` in the browser or OS certificate store, then
visit `https://painscaler.lan`.

## Make targets

| Target | Purpose |
|--------|---------|
| `make help`     | List all targets. |
| `make init`     | Generate env, secrets, and rendered configs. |
| `make up`       | Start the stack. |
| `make down`     | Stop the stack (volumes retained). |
| `make logs`     | Tail every container's logs. |
| `make ca`       | Extract the root CA cert. |
| `make rotate`   | Regenerate all secrets. Invalidates active sessions. |
| `make hash PASSWORD=xxx` | Argon2id-hash a custom password. |
| `make mfa`      | Tail Authelia `notifications.txt` for the TOTP enrolment URL. |
| `make nuke`     | Wipe volumes. Destructive. |

## Generated files

| Path | Contents |
|------|----------|
| `secrets/`                              | Random secrets (gitignored, mode 600). |
| `authelia/configuration.yml`            | Rendered from `.tmpl` (gitignored). |
| `authelia/users_database.yml`           | Rendered from `.tmpl` (gitignored). |
| `.env`                                  | ZPA credentials (gitignored). |

## Network topology

| Port | Container | Exposure |
|------|-----------|----------|
| 80, 443 | `caddy`           | Public. |
| 8080    | `painscaler-api`  | Intra-network only. `/metrics` is scrapable from inside the network. |
| 80      | `painscaler-web`  | Intra-network only. Served via Caddy. |
| 9091    | `authelia`        | Intra-network only. Forward-auth target. |

External access to `painscaler-api` is not possible: the service uses
`expose:` rather than `ports:`. Caddy enforces authentication via Authelia
before forwarding upstream.

## Domain configuration

Default uses `painscaler.lan` and `auth.lan`. Change in `Caddyfile` and
`authelia/configuration.yml.tmpl` (`session.cookies[0].domain`,
`authelia_url`, `default_redirection_url`) to use a different suffix.

`.local` triggers mDNS resolution on macOS and Linux. Use `.lan` or
`.home.arpa` instead.

## First MFA enrolment

Authelia's file-notifier writes TOTP enrolment links and codes to
`authelia/notifications.txt`:

```bash
make mfa
```

Open the link in a fresh tab to register an authenticator app.

## Public deployment

For a public deployment with `painscaler.com`:

1. Replace `local_certs` (or `tls internal`) in `Caddyfile` with the
   default Let's Encrypt directive.
2. Open ports 80 and 443 publicly.
3. Point DNS at the host.

The Authelia user database, session secrets, and the rest of the stack
require no changes.
