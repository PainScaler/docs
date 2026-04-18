---
title: Observability
description: Structured JSON logs, Prometheus metrics, and browser telemetry.
sidebar:
  order: 2
---

The backend writes structured JSON logs and exposes Prometheus metrics. The
frontend posts page-view and error events to a telemetry endpoint that fans
out to the same log and metric streams.

Only metadata is recorded. No request payloads are logged. Incoming
request bodies are capped at 1 MiB (`maxRequestBodyBytes` in
`internal/server/server.go`); requests over the cap fail at the
middleware layer before the handler runs.

## Logs

Rotated JSONL on the `painscaler_data` volume:

```
/data/logs/painscaler.log
/data/logs/painscaler-2026-04-15T10-22-31.000.log.gz
...
```

Errors mirror to stderr regardless of log level, so
`docker logs painscaler-api` surfaces them.

### Configuration

| Var                | Default        | Meaning |
|--------------------|----------------|---------|
| `LOG_DIR`          | `/data/logs`   | Log directory. |
| `LOG_LEVEL`        | `info`         | `debug` / `info` / `warn` / `error`. |
| `LOG_MAX_SIZE_MB`  | `50`           | Rotate when the current file exceeds this size. |
| `LOG_MAX_BACKUPS`  | `10`           | Number of rotated files retained. |
| `LOG_MAX_AGE_DAYS` | `30`           | Maximum age of rotated files. |
| `LOG_COMPRESS`     | `true`         | Gzip rotated files. |

### Per-request log shape

Every HTTP request produces one record after completion:

```json
{
  "time": "2026-04-16T20:11:42.331Z",
  "level": "INFO",
  "msg": "http request",
  "service": "painscaler",
  "version": "1.0.0",
  "commit": "4a57559",
  "request_id": "5f9e...",
  "route": "/api/v1/segment/:segmentID/policies",
  "method": "GET",
  "status": 200,
  "duration_ms": 12,
  "bytes_out": 4218,
  "client_ip": "10.0.1.42",
  "user_agent": "Mozilla/5.0 ...",
  "user": "alice"
}
```

`route` is `c.FullPath()` (the Gin route template). Path parameters do not
inflate cardinality in log aggregators or Prometheus labels.

### Example queries

```bash
# All errors
docker compose cp painscaler-api:/data/logs/painscaler.log - | \
  jq -c 'select(.level=="ERROR")'

# Top routes by request count
docker compose cp painscaler-api:/data/logs/painscaler.log - | \
  jq -r 'select(.msg=="http request") | .route' | \
  sort | uniq -c | sort -rn | head

# Slow requests (duration_ms > 500)
docker compose cp painscaler-api:/data/logs/painscaler.log - | \
  jq -r 'select(.msg=="http request" and .duration_ms > 500) | [.route, .duration_ms] | @tsv'

# Browser-side errors only
docker compose cp painscaler-api:/data/logs/painscaler.log - | \
  jq -c 'select(.source=="frontend" and .type=="error")'
```

The distroless image does not include `jq`. Copy the file out and pipe
locally.

## Metrics

`http://painscaler-api:8080/metrics`. Reachable from inside the compose
network only. Caddy does not proxy `/metrics`.

| Metric | Type | Labels |
|--------|------|--------|
| `painscaler_http_requests_total`           | counter   | `route`, `method`, `status` |
| `painscaler_http_request_duration_seconds` | histogram | `route`, `method` |
| `painscaler_frontend_events_total`         | counter   | `type` (`page_view`, `error`) |
| `painscaler_build_info`                    | gauge = 1 | `version`, `commit`, `date` |

Routes use the Gin template (`/api/v1/segment/:segmentID/policies`).
Cardinality is bounded by the route count.

### Adding a Prometheus container

Append to `deploy/docker-compose.yml`:

```yaml
prometheus:
  image: prom/prometheus
  expose: ["9090"]
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
  networks: [painscaler]
```

Create `deploy/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: painscaler
    static_configs:
      - targets: ["painscaler-api:8080"]
```

Expose Prometheus through Caddy to access the UI from outside the network.

## Frontend telemetry

The browser buffers events and POSTs them to `/api/v1/telemetry`. Two
event types are emitted:

- `page_view` — fired on every route change in the SPA.
- `error` — fired by the React `ErrorBoundary` when a render throws.

Flush rules:

- Every 30 seconds via `fetch`.
- On `visibilitychange` (tab hidden) via `navigator.sendBeacon`.
- On `pagehide` via `sendBeacon`.
- Immediately when the buffer reaches 100 events.

Failures are dropped without retry to avoid telemetry-induced error loops.

### Server side

`POST /api/v1/telemetry` walks the batch, emits one slog line per event
with `source=frontend`, and increments
`painscaler_frontend_events_total{type=...}`. `Remote-User` (when present
and trusted) is attached to each log line.

Batch size is capped at 100 events. Larger batches are truncated.

## Correlation

Both sides log the same `request_id` for every backend call. The server
sets `X-Request-Id` on the response. The browser does not propagate
`X-Request-Id` into subsequent telemetry events; current correlation is
by `route` and `time`. See [Roadmap](/reference/roadmap/).

## Why JSONL plus Prometheus

- The on-disk JSONL is the system of record and survives Prometheus
  outages.
- OpenTelemetry is not a dependency. If required later, the metrics
  package is a small, self-contained replacement surface.
