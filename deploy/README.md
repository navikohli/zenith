# Zenith Deployment

This directory contains deployment configurations for Zenith.

## Deployment Options

| Option                                     | For                          | Infrastructure       |
| ------------------------------------------ | ---------------------------- | -------------------- |
| **[Self-Hosted](./self-hosted/README.md)** | Community & Enterprise users | Docker, Bun, any VPS |
| **[Cloud](./cloud/README.md)**             | Zenith team only          | Cloudflare Workers   |

---

## Self-Hosted (Recommended for most users)

Deploy Zenith on your own infrastructure with full control over your data.

### Quick Start with Docker

```bash
docker run -d \
  --name zenith \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/zenith" \
  -e SECRET_KEY="your-secret-32-chars-minimum" \
  -e BASE_URL="https://your-domain.com" \
  ghcr.io/zenith/zenith:latest
```

### With Docker Compose

```bash
git clone https://github.com/zenith/zenith.git
cd zenith
cp .env.prod.example .env
# Edit .env with your settings (generate secrets with: openssl rand -base64 32)
docker compose -f docker-compose.prod.yml up -d
```

> The root `docker-compose.yml` is for **local development only** (datastores, no app service). Use `docker-compose.prod.yml` to self-host — it bundles the app plus Postgres and Silo (the maintained MinIO fork) with hardened defaults.

See the [Self-Hosted Guide](./self-hosted/README.md) for complete documentation.

---

## Zenith Cloud (Internal)

The `cloud/` directory contains Cloudflare Workers deployment configuration for Zenith Cloud (app.zenith.io).

> **Note**: This is used internally by the Zenith team. Self-hosted users should ignore this directory.

See the [Cloud Deployment Guide](./cloud/README.md) for internal documentation.

---

## Directory Structure

```
deploy/
├── README.md              # This file
├── cloud/                 # Zenith Cloud (Cloudflare Workers)
│   ├── README.md          # Cloud deployment guide
│   ├── wrangler.jsonc     # Base wrangler config
│   ├── wrangler.dev.jsonc # Development environment
│   ├── wrangler.production.jsonc  # Production environment
│   ├── .dev.vars.example  # Secrets template
│   └── .gitignore         # Ignores .dev.vars
└── self-hosted/           # Self-hosting documentation
    └── README.md          # Self-hosted deployment guide
```

---

## Build Variants

Zenith supports different build configurations:

| Command                           | Edition     | EE Features | Target     |
| --------------------------------- | ----------- | ----------- | ---------- |
| `bun run build`                   | Self-hosted | No          | Bun        |
| `bun run build:community`         | Self-hosted | No          | Bun        |
| `bun run build:enterprise`        | Self-hosted | Yes         | Bun        |
| `bun run build:cloud`             | Cloud       | Yes         | Cloudflare |
| `bun run deploy:cloud:dev`        | Cloud       | Yes         | Cloudflare |
| `bun run deploy:cloud:production` | Cloud       | Yes         | Cloudflare |

The build target is controlled by `EDITION` environment variable:

- `self-hosted` (default): Standard Vite build for self-hosted deployments
- `cloud`: Uses `@cloudflare/vite-plugin` for Cloudflare Workers

---

## License

- **Core**: AGPL-3.0 (open source)
- **Enterprise Features**: Proprietary (requires license key)

Enterprise features include SSO/SAML, SCIM, and Audit Logs. Contact sales@zenith.io for licensing.
