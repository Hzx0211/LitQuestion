<h1 align="center">LitQuestion</h1>

<p align="center">
  <strong>主线别跑偏，小问题有座位。</strong>
</p>

<p align="center">
  一个为阅读、研究、写作和长对话准备的本地桌面 AI 客户端。
</p>

<p align="center">
  <img alt="Windows build" src="https://github.com/Hzx0211/LitQuestion/actions/workflows/windows-build.yml/badge.svg" />
  <img alt="Desktop release" src="https://github.com/Hzx0211/LitQuestion/actions/workflows/release.yml/badge.svg" />
  <img alt="Tauri v2" src="https://img.shields.io/badge/Tauri-v2-D97B46?style=flat-square" />
  <img alt="React 18" src="https://img.shields.io/badge/React-18-4C8E91?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.6-3E6C93?style=flat-square" />
</p>

## 中文

### LitQuestion 是什么

LitQuestion 是一个本地桌面 AI 客户端，适合把大模型当作研究搭子、阅读搭子、写作搭子或者学习搭子来用。

它最关心的一件事是：不要让一个很好的主线对话，被一堆临时冒出来的小问题挤乱。

所以 LitQuestion 把聊天分成两层：

- **主窗口**：放真正重要的主线问题，像一张干净的研究桌。
- **副窗口**：放临时追问、概念补丁、引用确认和顺手一问，像桌边的小纸条。

你可以继续认真读主回答，也可以把某条 AI 回复拖到右侧开一个小分支。小问题有地方坐，主线也不会被带跑。

### 为什么做它

长对话很容易变成一团线：

- 看到一个专业词，想问一下。
- 看到一个引用，想核一下。
- 看到一个推理步骤，想补一句。
- 看到一个好回答，又不想让它被后面的碎问题淹没。

普通聊天窗口里，这些小追问都会挤进同一条主线。过一会儿再回头看，最有价值的回答就藏进了聊天记录深处。

LitQuestion 的思路是把这些小岔路收进副窗口。它不打断主线，但也不丢掉灵感。

### 主要功能

- **主线聊天**：保留核心问题和主要思路，让长对话更容易回看。
- **副窗口追问**：围绕某条 AI 回复展开小分支，适合临时问题和局部澄清。
- **选择性回流**：副窗口内容默认不打扰主上下文，重要时再手动并回主线。
- **高光回复**：把关键 AI 回复标记出来，像给笔记贴上一张小书签。
- **对话记录面板**：用紧凑时间线快速跳回重要回复。
- **文档和图片上传**：从输入框左侧的 `+` 按钮添加图片、PDF、文本、Markdown、代码、CSV、JSON 等文件。
- **PDF 文本提取**：PDF 内容会在本地解析后加入提问上下文。
- **模型选择面板**：在主输入框里快速切换当前模型。
- **模型列表同步**：在 API 设置页同步供应商可用模型，再勾选你想出现在输入框里的模型。
- **本地保存**：会话和消息存 SQLite，设置存在本地，API Key 存系统 Keychain。
- **桌面体验**：悬浮输入框、可调整副窗口、折叠侧栏、浅色界面和本地设置页。

### 适合谁

LitQuestion 比较适合这些使用场景：

- 读论文、读书、整理文献。
- 写文章、写大纲、改段落。
- 学习一个复杂主题，希望主线和小问题分开。
- 长时间使用 AI 做研究，希望聊天记录别乱成一锅粥。
- 需要在不同模型之间切换，比如 DeepSeek、Kimi、MiniMax、GLM 或 SiliconFlow。

### 一个典型工作流

1. 在主窗口里提出一个研究问题，开始主线对话。
2. 上传 PDF 或文档，让 AI 带着材料一起讨论。
3. 看到一条很有用的回复，标成高光。
4. 如果这条回复里有一个小点想追问，就拖到右侧副窗口。
5. 小问题在副窗口解决，主线继续保持清爽。
6. 如果副窗口内容后来变重要，再把它加入主上下文。
7. 回看时打开对话记录面板，直接跳到关键回复。

### 模型与 API

LitQuestion 使用 OpenAI 兼容的 Chat Completions 接口。你需要准备自己的 API Key 和 Base URL。

目前内置了这些供应商预设：

- OpenAI
- Claude 兼容端点
- DeepSeek
- Kimi / Moonshot
- MiniMax
- GLM / Z.AI
- SiliconFlow
- 自定义 OpenAI 兼容服务

在设置页里可以配置：

- Provider ID
- Base URL
- Model
- Temperature
- System Prompt
- API Key
- 可出现在主输入框里的模型列表

对于支持模型列表接口的供应商，可以点击刷新按钮同步当前账号可用模型。SiliconFlow 会优先使用同步后的真实模型列表，减少选到过期模型 ID 的情况。

### 本地数据与隐私

LitQuestion 尽量把东西放在本机：

- 会话和消息：SQLite
- 应用设置：本地 store
- API Key：系统 Keychain
- 上传文档：在本地整理成提示词上下文后再发给模型接口

LitQuestion 本身不提供模型服务，也不会替你托管 API Key。你使用哪个模型服务，就由你配置的接口决定。

### 技术栈

- Tauri v2
- React 18
- TypeScript
- Vite 5
- Zustand
- SQLite
- Rust
- `react-markdown`
- `remark-gfm`
- `rehype-highlight`
- `pdfjs-dist`

### 本地运行

#### 准备条件

- Node.js
- Rust toolchain
- Tauri v2 所需的系统依赖
- 一个 OpenAI 兼容 API Key

#### 安装依赖

```bash
npm install
```

#### 启动开发环境

```bash
npm run tauri:dev
```

#### 构建前端

```bash
npm run build
```

#### 构建桌面应用

```bash
npm run tauri:build
```

### 截图位置

当前仓库还没有提交正式截图。后续可以放在这些路径：

- `docs/assets/readme-main.png`：主窗口和输入框。
- `docs/assets/readme-side-panel.png`：副窗口追问。
- `docs/assets/readme-settings.png`：API 和模型设置。

放好图片后，再在 README 里引用即可。

### GitHub Actions

仓库里已经配置了桌面构建工作流：

- `.github/workflows/windows-build.yml`
- `.github/workflows/release.yml`

推送到 `main` 会触发 Windows 安装包构建。打 `v*` 标签可以走正式发布流程。

### 项目结构

```text
src/
  components/        React UI 组件
  lib/               聊天、设置、附件、模型预设、消息树工具
  store/             Zustand 全局状态
src-tauri/
  src/               Rust 命令、流式聊天、Keychain
  capabilities/      Tauri 权限
  tauri.conf.json    桌面应用配置
docs/
  plans/             设计和实现笔记
```

### 当前状态

LitQuestion 还在持续打磨中，但核心体验已经能用了：

- 主线聊天
- 副窗口分支追问
- 高光关键回复
- 对话记录概览
- 本地持久化
- API 设置和模型选择
- 文档与图片附件

接下来会继续优化交互细节、供应商兼容性、发布体验和 README 截图。

### 参与项目

- 有建议或问题，可以开 Issue。
- 提交改动前请看 [CONTRIBUTING.md](CONTRIBUTING.md)。
- 安全相关问题请看 [SECURITY.md](SECURITY.md)。
- 协作默认遵循 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

### License

当前仓库还没有单独声明 License。

---

## English

### What Is LitQuestion

LitQuestion is a local desktop AI client for reading, research, writing, and long conversations.

Its main job is small but useful: keep the important conversation clean, and give little follow-up questions their own place to sit.

LitQuestion separates your workspace into two layers:

- **Main window**: for the core question, argument, and long-form thinking.
- **Side panel**: for tiny follow-ups, term checks, citation notes, and quick clarifications.

You can keep reading the main answer, or drag an AI response to the side and open a small branch around it. The main thread stays tidy, while the little questions still get handled.

### Why It Exists

Long AI chats can get messy quickly.

You read a great answer, then a small question appears. Then another. Then a citation check. Then a term you want explained. Before long, the best answer is buried under a stack of tiny detours.

LitQuestion gives those detours a side panel. They stay connected to the exact AI answer that caused them, but they do not take over the main conversation.

### Features

- **Main conversation thread**: keep your primary line of thought readable.
- **Side-question panel**: drag an AI answer to open a focused follow-up branch.
- **Selective context return**: keep side branches separate, or include them back into the main context when they become important.
- **Highlighted answers**: mark key AI replies so they are easy to find again.
- **Conversation overview**: jump through important AI responses with a compact timeline panel.
- **Document and image attachments**: add images, PDFs, text files, Markdown, code, CSV, JSON, and other readable files from the `+` button.
- **PDF text extraction**: PDF content is parsed locally and added to the prompt context.
- **Input-box model picker**: switch models directly from the main composer.
- **Model list sync**: sync available provider models, then choose which ones appear in the input picker.
- **Local persistence**: conversations and messages use SQLite, settings stay local, and API keys live in the system keychain.
- **Desktop-first UI**: floating composer, resizable side panel, collapsible sidebar, light theme, and local settings.

### Who It Is For

LitQuestion is useful when you:

- Read papers, books, or technical documents.
- Draft articles, outlines, or research notes.
- Study complex topics and want side questions separated from the main path.
- Use AI for long sessions and want the conversation to stay readable.
- Switch between providers such as DeepSeek, Kimi, MiniMax, GLM, or SiliconFlow.

### Typical Workflow

1. Start with a research question in the main window.
2. Attach a PDF or document when the model needs source material.
3. Highlight a useful AI response.
4. Drag that response to the side panel when a small question appears.
5. Resolve the side question without cluttering the main thread.
6. Include the side branch back into the main context only when it matters.
7. Use the conversation overview to jump back to key answers.

### Models And APIs

LitQuestion uses OpenAI-compatible Chat Completions APIs. You bring your own API key and Base URL.

Built-in provider presets include:

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
- System Prompt
- API Key
- Models available in the main input picker

For providers that expose a model-list endpoint, use the refresh button in API settings to sync available models. SiliconFlow uses the synced list first, which helps avoid stale model IDs.

### Local Data And Privacy

LitQuestion keeps data on your machine:

- Conversations and messages: SQLite
- App settings: local store
- API keys: system keychain
- Uploaded documents: prepared locally before being sent as prompt context

LitQuestion does not host a model service. Requests go to the provider you configure.

### Tech Stack

- Tauri v2
- React 18
- TypeScript
- Vite 5
- Zustand
- SQLite
- Rust
- `react-markdown`
- `remark-gfm`
- `rehype-highlight`
- `pdfjs-dist`

### Getting Started

#### Prerequisites

- Node.js
- Rust toolchain
- Tauri v2 platform requirements
- An OpenAI-compatible API key

#### Install

```bash
npm install
```

#### Run In Development

```bash
npm run tauri:dev
```

#### Build Frontend

```bash
npm run build
```

#### Build Desktop App

```bash
npm run tauri:build
```

### Screenshots

Screenshots are not committed yet. Recommended paths:

- `docs/assets/readme-main.png` for the main window.
- `docs/assets/readme-side-panel.png` for side-question branching.
- `docs/assets/readme-settings.png` for API and model settings.

After adding the files, reference them from this section.

### GitHub Actions

This repository includes desktop build workflows:

- `.github/workflows/windows-build.yml`
- `.github/workflows/release.yml`

Pushing to `main` triggers the Windows installer build. Tags matching `v*` are intended for the release workflow.

### Project Structure

```text
src/
  components/        React UI components
  lib/               Chat, settings, attachments, model presets, tree helpers
  store/             Zustand global state
src-tauri/
  src/               Rust commands, streaming chat, keychain integration
  capabilities/      Tauri permissions
  tauri.conf.json    Desktop app config
docs/
  plans/             Design and implementation notes
```

### Status

LitQuestion is still being polished, but the core workflow is already in place:

- Main chat
- Side-question branching
- Highlighted AI answers
- Conversation overview
- Local persistence
- API settings and model selection
- Document and image attachments

Next up: interaction polish, provider compatibility, release packaging, and README screenshots.

### Contributing

- Issues and suggestions are welcome.
- See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes.
- See [SECURITY.md](SECURITY.md) for security-related reports.
- See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community expectations.

### License

No standalone license file has been declared yet.
