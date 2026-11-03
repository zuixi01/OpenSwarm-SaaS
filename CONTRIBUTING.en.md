# Contributing

This repository is a pre-release SaaS extension of [goldct/openswarm](https://github.com/goldct/openswarm). [简体中文](CONTRIBUTING.md)

## Setup and checks

Fork this repository and clone your fork. To inspect the current repository directly:

```bash
git clone https://github.com/zuixi01/OpenSwarm-SaaS.git
cd OpenSwarm-SaaS
git switch -c fix/your-change
node scripts/check-repository.js
node --test scripts/check-repository.test.js
cd panel-web
npm ci --ignore-scripts
npm run check
npm run test:smoke
npm start
```

Use Node.js 22.12+ and npm. CI targets Node.js 22 and 24. The default panel URL is <http://localhost:3999>; stop it with Ctrl+C. Full OpenClaw runtime setup requires `bash install.sh` from the repository root. See [README](README.md) for SaaS database configuration and explicit environment loading.

The root repository check guards the current working tree against runtime data and sensitive files; its tests verify those rules. It does not audit all Git history. `npm run check` runs JavaScript syntax checks, OpenAPI document structure checks and repository tests. The OpenAPI check currently parses the document and checks four required paths; it is not complete API contract validation. `npm run test:smoke` verifies startup, health, the home page and token authentication in a temporary clean directory. Also verify the actual behavior affected by your change. Database, external-model and multiple-runtime scenarios require separate environments; state clearly when you have not run them.

## Report an issue

Search [this repository's Issues](https://github.com/zuixi01/OpenSwarm-SaaS/issues) first. For ordinary bugs, include reproduction steps, expected and actual behavior, OS, Node.js version and redacted logs. Never attach API keys, cookies, tokens, database credentials or a complete `.env`.

Follow [the security policy](SECURITY.en.md) for vulnerabilities. Do not publish vulnerability details or proof-of-concept material in an Issue.

## Submit a pull request

Keep changes focused and follow the surrounding code style. Update related documentation when behavior changes, and add tests that cover relevant boundaries or regressions. Do not commit generated runtimes, user data, logs or credentials.

Explain the problem, resulting behavior, checks actually run and any untested scenarios. Commit prefixes such as `fix:`, `feat:`, `docs:` and `test:` are welcome. Keep unrelated formatting and refactoring out of a fix.

## Licensing and collaboration

Contribute only code you have permission to distribute under this repository's [GPL-3.0-or-later license](LICENSE). Preserve upstream and third-party notices. Keep discussions respectful and focused on facts and code.
