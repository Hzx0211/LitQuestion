# Contributing to LitQuestion

Thanks for helping improve LitQuestion.

## Before You Start

- Open an issue first for large feature ideas or behavior changes.
- Keep changes scoped. LitQuestion is still an opinionated personal project, so small and focused proposals are much easier to review.
- Do not commit API keys, personal data, or local app databases.

## Local Setup

```bash
npm install
npm run tauri:dev
```

If you touch build or desktop integration code, also run:

```bash
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## Project Expectations

- Preserve the core product idea: keep the main thread clean and move tiny follow-up questions into the side branch flow.
- Prefer incremental UI changes over broad rewrites.
- Match the existing code style and naming patterns.
- Keep README screenshots in `docs/assets/`.
  - `readme-main.png`
  - `readme-detail.png`

## Pull Requests

- Explain the user problem first, then the fix.
- Include screenshots for UI changes when possible.
- Mention any follow-up work or tradeoffs that remain.
- Keep one PR focused on one problem.

## Commit Messages

Use short, descriptive commit messages. Examples:

- `Fix side panel pointer event blocking`
- `Add Windows build workflow`
- `Polish settings layout`

## What Not to Submit

- Pure formatting churn without a product or maintenance benefit
- Unrelated refactors mixed into a bug fix
- Generated binaries, local databases, or secret config files

