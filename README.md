<h1 align="center">LitQuestion</h1>

<p align="center">
  <strong>把主线问题留给 GPT 老师，把小问题留给“同桌”。</strong>
</p>

<p align="center">
  A desktop LLM client that keeps your main thread clean while letting tiny follow-up questions stay on the side.
</p>

<p align="center">
  <img alt="Windows build" src="https://github.com/Hzx0211/LitQuestion/actions/workflows/windows-build.yml/badge.svg" />
  <img alt="Desktop release" src="https://github.com/Hzx0211/LitQuestion/actions/workflows/release.yml/badge.svg" />
  <img alt="Tauri v2" src="https://img.shields.io/badge/Tauri-v2-D97B46?style=flat-square" />
  <img alt="React 18" src="https://img.shields.io/badge/React-18-4C8E91?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.6-3E6C93?style=flat-square" />
</p>

## 为什么会有 LitQuestion

我经常把 GPT 当成老师、研究助手或者写作搭子来用。

问题是，GPT 经常会给出一些我很喜欢、很关键的回答，而我在读这些回答时，又会不断冒出一些很小的问题。
比如：

- 某个专业名词我不懂
- 某个引用我想顺手确认
- 某个细节我只想补一句追问

这些小问题如果直接继续塞回主聊天，会发生两件事：

- 主上下文越来越杂，原本最有价值的那条回答被很多枝节问题冲淡
- 过一段时间回看历史时，想重新找到那个关键回答会很痛苦

所以 LitQuestion 做的事情其实很简单：

**把“小问题”从主聊天里拎出来。**

主窗口继续保留主线思路，副窗口专门承接那些轻量追问、概念补丁和临时分支。

> 它有点像上课时听 GPT 老师讲课。  
> 途中遇到一个小问题，我不会举手打断老师，而是转头小声问同桌。  
> 这样既不打乱老师的讲课节奏和主笔记，我也能马上把不懂的地方补上。

这就是 LitQuestion 想提供的体验。

## README 截图放哪里

等你自己截图时，直接把图片放到这里：

- `docs/assets/readme-main.png`：主界面全图
- `docs/assets/readme-detail.png`：局部细节图，比如高光回答、分支入口或副窗口

这样后面只要把截图文件补进去，就能继续沿用这套 README 目录结构，不需要再挪路径。

## 它和普通聊天客户端有什么不一样

- **主线优先**：主窗口负责真正的核心问题，不让临时追问把上下文带歪
- **副窗口追问**：围绕某一条 AI 回答开出轻量分支，专门处理“小问题”
- **选择性回流**：只有当一条侧边分支真的重要时，才手动并回主上下文
- **高光概览**：把你最喜欢、最关键的回答单独标出来，回看时直接定位
- **本地桌面化**：像正常桌面软件一样用，不必每次都从网页聊天开始

## 核心功能

- 主聊天窗口：承载主线问题和主要思路
- 副窗口分支：基于某条 AI 回答展开轻量追问
- 高光标记：把值得留下的回答单独标星
- 高光概览：从时间线里快速回到关键回答
- 本地持久化：会话、消息、设置都保存在本地
- OpenAI 兼容接口：支持自定义 Base URL、Model、API Key
- Windows 自动打包：推到 GitHub 后可直接生成 Windows 安装包

## 一个典型工作流

1. 先在主窗口里和模型聊主问题。
2. 看到一条非常好的回答，先标成高光。
3. 如果里面冒出某个小问题，就在副窗口里追问，而不是打断主线。
4. 只有当这个副链真的重要，再把它并回主上下文。

## 适合谁

- 经常把 GPT 当老师、研究助手、写作搭子的人
- 会反复回看历史回答的人
- 很在意上下文干净度的人
- 讨厌“一个小问题把整段主线聊歪”的人

## 技术栈

- Tauri v2
- React 18
- TypeScript
- Vite 5
- Zustand
- SQLite

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发环境

```bash
npm run tauri:dev
```

### 3. 构建桌面应用

```bash
npm run tauri:build
```

## 配置要求

LitQuestion 本身不提供模型服务，需要你自己提供兼容 OpenAI API 的接口信息：

- Base URL
- Model
- API Key

应用启动后可在设置页填写。

## 下载与打包

### Windows 试用包

仓库的 `main` 分支会自动触发 Windows 打包工作流。

你可以在这里下载最近一次的 Windows 安装包 artifact：

- `Actions` -> `Build Windows Installer`
- artifact 名称：`LitQuestion-Windows-Installer`
- 安装包文件通常是：`LitQuestion_0.1.0_x64-setup.exe`

### 正式桌面发布

仓库也配置了 release workflow：

- 给仓库推一个 `v*` 标签
- GitHub Actions 会构建并发布
- 产物包括 Windows `.exe` 和 macOS `.dmg`

## 当前状态

这是一个仍在持续打磨中的个人项目，但核心体验已经成形：

- 主线聊天
- 副窗口分支追问
- 高光回答标记与概览
- 本地桌面化使用
- GitHub Actions 自动打包

后续还会继续优化交互细节、跨平台体验和发布流程。

## 仓库协作

- 提建议或报问题：开 Issue
- 提交改动前先看 [CONTRIBUTING.md](CONTRIBUTING.md)
- 涉及安全问题先看 [SECURITY.md](SECURITY.md)
- 协作讨论默认遵循 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

当前仓库暂未单独声明 License。

如果你想试用、交流或者提建议，欢迎直接开 Issue。
