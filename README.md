# zenith

Zenith is your self-hosted feedback hub. It runs the existing TypeScript/Bun,
React/TanStack, PostgreSQL and object-storage stack locally, with application-signed
product identity, private page screenshots and browser diagnostics, and a headless
feedback-to-delivery workflow.

Feedback can be claimed and assessed collectively, saved as a private implementation
plan, approved by its exact hash, implemented and tested, then closed after a matching
deployment receipt and smoke check. Reporter notifications use the existing job queue
and mail provider. See the [feedback workflow guide](docs/zenith-feedback-loop.md)
for product registration, API access, agent adapters and approval/deployment boundaries.

## Run locally on Windows

Install/start Docker Desktop with its Linux engine and ensure Git and PowerShell 7 are available.
From this directory in PowerShell:

```powershell
./scripts/zenith.ps1 up
```

Open http://localhost:3100. Complete the first-run account/workspace setup as Zenith.
The helper creates `.env.zenith.local` with random local credentials, packages source,
builds the first application image and waits for healthy services.
Later `up` commands reuse the image; use `rebuild` after source changes. No hosted email/AI keys
are required; local email messages are logged by the existing application mailer.

```powershell
./scripts/zenith.ps1 status
./scripts/zenith.ps1 logs
./scripts/zenith.ps1 rebuild
./scripts/zenith.ps1 down
```

The app is bound to localhost. PostgreSQL and storage have no published host ports.
`down` preserves volumes. Do not use `down --volumes` unless intentionally erasing data.
The Compose stack is local development only; a public deployment needs a real origin,
HTTPS, backups and a configured sender.

## Source and license

See UPSTREAM_NOTICES.md and LICENSE for upstream provenance and AGPL terms.
The running service provides corresponding source and build material at /source.html.
Keep `.env.zenith.local`, database contents and uploaded files out of Git and archives.
