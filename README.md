<h1 align="center">LitQuestion</h1>

<p align="center">
  <strong>面向阅读、研究和写作的本地桌面 AI 客户端。</strong>
</p>

<p align="center">
  Keep the main thread clean. Ask side questions without losing the original argument.
</p>

<p align="center">
  <img alt="Windows build" src="https://github.com/Hzx0211/LitQuestion/actions/workflows/windows-build.yml/badge.svg" />
  <img alt="Desktop release" src="https://github.com/Hzx0211/LitQuestion/actions/workflows/release.yml/badge.svg" />
  <img alt="Tauri v2" src="https://img.shields.io/badge/Tauri-v2-D97B46?style=flat-square" />
  <img alt="React 18" src="https://img.shields.io/badge/React-18-4C8E91?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.6-3E6C93?style=flat-square" />
</p>

## Overview

LitQuestion is a local desktop LLM client built with Tauri, React, and TypeScript. It is designed for people who use AI as a research assistant, reading companion, writing partner, or study tutor.

The core idea is simple: keep your primary conversation focused, and move small follow-up questions into side branches. When a response is important, you can highlight it, revisit it from the conversation overview, or open a side panel around that exact answer without disrupting the main thread.

## Why LitQuestion

Long AI conversations often become difficult to read again. A strong answer may be followed by many tiny clarifications, citation checks, term explanations, and temporary detours. After a while, the main argument gets buried.

LitQuestion separates those concerns:

- The main window keeps the central question and argument.
- The side panel handles small follow-up questions anchored to a specific AI answer.
- Highlighted answers become easy to find again.
- Attachments such as PDFs, documents, and images can be added directly to a question.
- Model and provider settings stay local and configurable.

This makes the app useful for academic reading, literature review, note-taking, writing, and long-form study sessions.

## Features

- **Main conversation thread**: a focused GPT-style chat surface for the primary line of thought.
- **Side-question panel**: drag an AI answer to open a side panel and ask follow-up questions around that answer.
- **Selective context return**: side branches can stay separate or be included back into the main context when they become important.
- **Highlighted key answers**: mark important AI replies and revisit them from the conversation overview.
- **Conversation overview**: a compact timeline panel for quickly scanning and jumping to key AI responses.
- **Document and image attachments**: attach images, PDFs, text files, markdown, code files, CSV/JSON, and other readable documents.
- **PDF text extraction**: PDF content is extracted locally and included in the model prompt.
- **OpenAI-compatible APIs**: use OpenAI-style `/chat/completions` endpoints with custom Base URL, model, and API Key.
- **Model presets and sync**: built-in presets for OpenAI, Claude-compatible endpoints, DeepSeek, Kimi, MiniMax, GLM/Z.AI, SiliconFlow, and custom providers.
- **Provider model selection**: sync available models from compatible providers, then choose which models appear in the main input model picker.
- **Local persistence**: conversations and messages are stored in SQLite; settings are stored locally; API keys are stored in the system keychain.
- **Desktop-first UI**: floating input bar, split view, resizable side panel, local settings page, and a lightweight sidebar.

## Screenshots

Screenshots are not committed yet. Recommended paths:

- `docs/assets/readme-main.png` for the main chat experience.
- `docs/assets/readme-side-panel.png` for side-question branching.
- `docs/assets/readme-settings.png` for API and model settings.

After adding screenshots, reference them from this section.

## Typical Workflow

1. Start a main conversation around a paper, idea, outline, or research question.
2. Attach a PDF or document when the model needs source material.
3. Highlight a strong AI response so it is easy to find later.
4. Drag that response to open the side panel when you need a small clarification.
5. Keep the clarification separate, or include it back into the main context when it becomes relevant.
6. Use the conversation overview to jump between important AI answers.

## Model Providers

LitQuestion is designed for OpenAI-compatible chat completion APIs. The app currently includes presets for:

- OpenAI
- Claude-compatible endpoints
- DeepSeek
- Kimi / Moonshot
- MiniMax
- GLM / Z.AI
- SiliconFlow
- Custom OpenAI-compatible providers

The settings page lets you configure:

- Provider ID
- Base URL
- Model
- Temperature
- System prompt
- API Key
- Enabled model list for the input-box model picker

For providers that expose a model-list endpoint, use the refresh button in the API settings page to sync available models. For SiliconFlow, LitQuestion uses the synced model list to avoid selecting stale or unavailable model IDs.

## Local Data

LitQuestion keeps data on your machine:

- Conversations and messages: SQLite via `tauri-plugin-sql`
- App settings: local store via `tauri-plugin-store`
- API keys: system keychain via the Rust `keyring` crate
- Uploaded document content: prepared locally before being sent as prompt context

The app does not provide a hosted model service. You need your own API key and compatible endpoint.

## Tech Stack

- Tauri v2
- React 18
- TypeScript
- Vite 5
- Zustand
- SQLite
- Rust
- `react-markdown`, `remark-gfm`, `rehype-highlight`
- `pdfjs-dist` for PDF text extraction

## Getting Started

### Prerequisites

- Node.js
- Rust toolchain
- Platform requirements for Tauri v2
- An OpenAI-compatible API endpoint and API key

### Install

```bash
npm install
```

### Run In Development

```bash
npm run tauri:dev
```

### Build Frontend

```bash
npm run build
```

### Build Desktop App

```bash
npm run tauri:build
```

## Configuration

Open the settings panel inside LitQuestion and configure the API section:

1. Choose a provider preset or select custom.
2. Confirm the Base URL.
3. Enter or sync the model list.
4. Select which models should appear in the main input model picker.
5. Enter your API Key.
6. Save settings.

For academic workflows, PDF and document attachments can be added from the `+` button beside the main input box.

## GitHub Actions

This repository includes workflows for desktop builds:

- `.github/workflows/windows-build.yml`
- `.github/workflows/release.yml`

The Windows workflow builds an installer artifact from the main branch. The release workflow is intended for tagged releases.

## Project Structure

```text
src/
  components/        React UI components
  lib/               Chat, settings, attachments, model presets, tree helpers
  store/             Zustand app state
src-tauri/
  src/               Rust commands, streaming chat, keychain integration
  capabilities/      Tauri permissions
  tauri.conf.json    Desktop app config
docs/
  plans/             Design and implementation notes
```

## Status

LitQuestion is an actively evolving personal project. The core desktop workflow is implemented:

- Main chat
- Side-question branching
- Highlighted AI answers
- Conversation overview
- Local persistence
- API settings and model selection
- Document and image attachments

The next areas of work are interaction polish, provider compatibility, release packaging, and documentation screenshots.

## Contributing

- Issues and feature requests are welcome.
- See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes.
- See [SECURITY.md](SECURITY.md) for security-related reports.
- See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community expectations.

## License

No standalone license file has been declared yet.
