# painscaler-docs

Documentation site for [painscaler.com](https://painscaler.com). Built with
[Astro](https://astro.build) and [Starlight](https://starlight.astro.build/),
deployed on Cloudflare Pages.

## Develop

Requires Node 22+ and Yarn 4.

```bash
yarn install
yarn dev       # http://localhost:4321
```

## Build

```bash
yarn build     # static output -> dist/
yarn preview   # serve dist locally
```

## Deploy

Cloudflare Pages with Git integration. Build settings:

| Field            | Value        |
|------------------|--------------|
| Build command    | `yarn build` |
| Output directory | `dist`       |
| Node version     | `22`         |

`wrangler.toml` declares `pages_build_output_dir`, so local deploys work via:

```bash
yarn build
npx wrangler pages deploy
```

## Layout

```
src/
  assets/                     # logo, favicon, images
  components/                 # theme selector override
  content/
    docs/
      index.mdx               # landing
      getting-started.md
      data-model.md
      features/               # simulator, search, graph
      analytics/              # blast-radius, connector-load, domain-overlaps,
                              # orphan-clusters, policy-shadows, scim-reach
      deployment/             # docker-compose, observability, auth
      reference/              # api, architecture, env-vars, roadmap
  styles/theme.css            # PainScaler colour override
public/
  _headers                    # CF Pages security + caching
  _redirects                  # /github -> repo, legacy paths
astro.config.mjs              # Starlight config + sidebar
```
