# Korekt CLI

[![npm version](https://img.shields.io/npm/v/korekt-cli.svg)](https://www.npmjs.com/package/korekt-cli)
[![npm downloads](https://img.shields.io/npm/dm/korekt-cli.svg)](https://www.npmjs.com/package/korekt-cli)
[![license](https://img.shields.io/npm/l/korekt-cli.svg)](https://www.npmjs.com/package/korekt-cli)

AI-powered code review from your terminal.

## Installation

```bash
npm install -g korekt-cli
```

## Setup

```bash
kk config --key YOUR_API_KEY
```

## Local Workflow

### Review Your Changes

```bash
kk review main              # Review commits against main
kk stg                      # Review staged changes
kk diff                     # Review unstaged changes
```

### Choose AI Model

```bash
kk review -m                        # Interactive model picker
kk review -m gemini-3-flash-preview # Direct selection
```

Available models (ranked by recommendation):

1. **gemini-3-flash-preview** - Most efficient, recommended for daily use
2. **gemini-3.1-pro-preview** - Best quality for complex reviews
3. **gemini-2.5-pro** - High quality alternative
4. **gemini-2.5-flash** - Legacy, avoid

### Ignore Files

```bash
kk review main --ignore "*.lock" "dist/*"
```

## CI/CD Integration

### Post to Pull Request

```bash
kk review --comment         # Auto-posts findings to PR
```

Works with GitHub Actions, Azure Pipelines, and Bitbucket Pipelines.

### Post to Ticket

```bash
kk review --post-ticket     # Posts findings to linked Jira/Azure ticket
```

Ticket IDs are automatically extracted from branch names and commit messages.

### JSON Output

```bash
kk review main --json       # Machine-readable output
```

## Environment Variables

```bash
export KOREKT_API_KEY="your-api-key"
```

Alternative to `kk config --key`. Config file takes precedence.

## Help

```bash
kk --help
kk review --help
```

## License

MIT - See [LICENSE](./LICENSE) for details.
