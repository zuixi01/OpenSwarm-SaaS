# Contributing

Thank you for your interest in OpenSwarm! We welcome all forms of contribution.

## How to Contribute

### Report Issues

If you found a bug or have a feature suggestion:

1. Check [Issues](https://github.com/goldct/openswarm/issues) for existing reports
2. If none, create a new Issue with: clear description, steps to reproduce, expected vs actual behavior, environment info, logs/screenshots

### Submit Code

1. **Fork** the project
2. **Create branch**: `git checkout -b feature/your-feature-name` or `fix/your-bug-fix`
3. **Develop**: Follow code style, add comments, ensure it runs
4. **Test**: Verify changes, no regressions
5. **Commit**: Use [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, etc.
6. **Push and open Pull Request**

## Code Style

- 2-space indent
- Single quotes (unless string contains one)
- Meaningful names
- Comments for complex logic

## Dev Setup

```bash
git clone https://github.com/goldct/openswarm.git && cd openswarm
./install.sh
cd panel-web && npm install
./start-panel.sh
```

## Project Structure

```
openswarm/
├── panel-web/     # Backend + frontend
├── yin/            # Main gateway
├── hex-template/   # Hexagram template
├── install.sh
└── README.md
```

## Pull Request

1. Code runs correctly
2. Follows project style
3. Update docs if needed
4. Clear title, description, test notes

---

[中文贡献指南](CONTRIBUTING.md)
