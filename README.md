# OpenSwarm SaaS

An experimental SaaS extension of [goldct/openswarm](https://github.com/goldct/openswarm), built around an OpenClaw control panel and agent runtimes.

[简体中文](README.zh.md) · [Contributing](CONTRIBUTING.en.md) · [Security](SECURITY.en.md)

**Status: pre-release.** This repository adds user authentication, tenant management, PostgreSQL persistence and tenant runtime controls to the upstream local panel. These paths are under active development. It is not a production-readiness or capacity certification.

## Try the panel locally

Use **Node.js 22.12+** and npm. CI targets Node.js 22 and 24. macOS and Linux support the shell scripts; Windows users can preview the panel with Node.js or use WSL for the full runtime.

```bash
git clone https://github.com/zuixi01/OpenSwarm-SaaS.git
cd OpenSwarm-SaaS/panel-web
npm ci --ignore-scripts
npm start
```

Open <http://localhost:3999>. The panel binds to `127.0.0.1` by default. This starts the panel only. Agent execution needs the separate runtime installation below; SaaS login and persistence need PostgreSQL configuration. Model requests require your own provider credentials and may incur provider charges.

For remote or container access, explicitly set `PANEL_WEB_HOST` (containers need `0.0.0.0`) and enable authentication with `OPENSWARM_PANEL_TOKEN` or configured SaaS user authentication. The panel controls local files and processes; keep unauthenticated previews on the local machine. Public access also needs HTTPS and a reviewed network boundary.

## Install the full local runtime

From the repository root, in Bash on macOS, Linux or WSL:

```bash
bash install.sh
bash start-panel.sh
```

The installer downloads OpenClaw, installs dependencies and generates local gateway/agent configuration. Network access to npm and GitHub is required. Complete provider configuration in the panel before starting agents. Review the installer before running it; the default layout includes one main gateway and up to 64 agent definitions.

## Configure SaaS authentication and storage

Use a PostgreSQL database you control. Put configuration in the **repository root `.env`**, using the SaaS variables documented in [the OAuth setup guide](docs/cloud-mvp/google-oauth-setup.md) and [the panel environment template](panel-web/.env.example). Do not commit this file.

Load those variables before migrations and startup. The following Bash commands assume a shell-compatible `.env` written by you:

```bash
# Run from the repository root.
set -a
source .env
set +a
cd panel-web
npm run db:migrate
npm run db:migrate:phase1
npm run db:migrate:phase2
npm run db:migrate:phase3
npm start
```

Apply migrations to a new development database first. Existing deployments need a backup and migration review. Google OAuth is optional; [its guide](docs/cloud-mvp/google-oauth-setup.md) covers callback URLs and local HTTP cookie settings.

## Development and verification

```bash
cd panel-web
npm ci --ignore-scripts
npm run check
npm run test:smoke
```

See [CONTRIBUTING.en.md](CONTRIBUTING.en.md) for scope and environment details. Automated checks do not certify PostgreSQL migrations, real model calls, all 64 runtimes, tenant isolation in a deployed system or the absence of secrets in Git history. Before publication or deployment, complete [the release checklist](docs/RELEASE_CHECKLIST.md).

## Repository map

- `panel-web/`: Express backend, browser UI, authentication and tenant services.
- `yin/`, `hex-template/`: main gateway workspace and agent templates.
- `install.sh`, `start-panel.sh`: local runtime installation and startup.
- `docs/cloud-mvp/`: evolving SaaS schema, API and operational notes.
- `ops/production-500/`: deployment examples; the directory name is not a measured capacity claim.

[Deployment notes](docs/DEPLOY.md) and [historical changelog](CHANGELOG.md) include upstream material. SaaS implementation notes may describe planned work; use the code, current checks and release checklist to establish what has been verified.

## License and attribution

This project derives from **goldct/openswarm**. The original copyright notice is preserved. The repository is licensed under **GPL-3.0-or-later**, as stated in [LICENSE](LICENSE). Bundled third-party components retain their own notices, including [Agent Reach](yin/workspace/skills/agent-reach/LICENSE).

This fork does not grant commercial exceptions to upstream or third-party licenses. Historical upstream release numbers do not identify a stable release of this SaaS extension.
