# Security policy

[简体中文](SECURITY.md)

This repository is pre-release. Maintenance currently covers the default branch and the latest explicitly published pre-release. Historical upstream version numbers are not a security-support commitment for this fork.

## Report vulnerabilities privately

Do not disclose vulnerability details, real credentials or actionable exploit material in public Issues, pull requests or discussions.

Before making the repository public, maintainers must enable GitHub **Private vulnerability reporting** and verify that a regular user can use it. Once enabled, select **Report a vulnerability** from [this repository's Security page](https://github.com/zuixi01/OpenSwarm-SaaS/security).

If that option is unavailable, this repository does not yet provide a verified private reporting channel. Wait for maintainers to enable one; do not fall back to a public Issue. The upstream commercial contact is not this fork's security-reporting address.

Include the affected commit or version, prerequisites, reproduction steps, impact and any proposed fix. Redact logs and screenshots. There is currently no guaranteed response window or bug bounty.

## Operational boundaries

The panel can configure model credentials, access local files and start or stop agents. It binds to `127.0.0.1` by default. Remote or container access requires an explicit `PANEL_WEB_HOST` (`0.0.0.0` for containers) and authentication through `OPENSWARM_PANEL_TOKEN` or configured SaaS user authentication. Public deployments need HTTPS, independent random secrets and a reviewed network boundary. Keep unauthenticated development previews local.

- Supply credentials through the deployment environment or an untracked root `.env`; never commit real values.
- Keep API keys, access/refresh tokens and cookies out of public logs and reports.
- Back up databases before migrations and use a least-privilege database account.
- Preserve upstream and third-party security updates and license notices.

## Verification limits

Current CI and tests define the automated coverage. They are not a complete security audit and do not establish that Git history contains no secrets, production tenant isolation works, real model calls succeed or all runtime scenarios are safe. Maintainers must complete [the release checklist](docs/RELEASE_CHECKLIST.md) before publication and release.
