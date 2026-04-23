# LitQuestion Agent Handoff

本文件用于在不同聊天会话之间接力 AI agent，避免重复消耗上下文。
**新会话开始时，agent 应先完整阅读本文件，再开始任何改动。**

---

## 1. 项目一句话描述

`LitQuestion` 是一个本地 macOS 大模型客户端（Tauri + React + TypeScript），复刻 GPT 风格对话，并在此基础上新增：
- 「小问题副窗口分支」：拖拽 AI 气泡到右侧，以该回答为锚点开启一条副对话链，可选择性并入主上下文。
- 「高光概览」：AI 气泡右上角星星按钮，**点击**可把当前 AI 回答标记为高光重点；**按住拖拽**到右侧区域则像以前一样打开副窗口追问。主输入框右侧的总览按钮唤起「高光概览」面板，只展开高光回答的摘要，其他问答用点缩略。
- 本地持久化（会话/消息 → SQLite；设置 → store；API Key → macOS Keychain）。

## 2. 技术栈

- 前端：`React 18` + `TypeScript` + `Vite 5` + `zustand` + `react-markdown` + `remark-gfm` + `rehype-highlight`
- 桌面壳：`Tauri v2`
- 存储：
  - 会话/消息：`tauri-plugin-sql`（SQLite，文件名 `litquestion.db`）
  - 设置：`tauri-plugin-store`（`settings.json`）
  - API Key：macOS Keychain，通过 `keyring` crate 暴露为 Tauri 命令
- 模型接口：OpenAI 兼容协议（`/v1/chat/completions`，SSE 流式）

## 3. 关键目录与文件

### React 层
- `src/App.tsx`：应用壳。顶层 `<div className="app">`，CSS 变量 `--app-font-size`（由 `settings.ui_font_size` 注入）挂在这里。
- `src/components/Sidebar.tsx`：左侧会话列表 + 底部 **用户卡片**（头像 + 用户名，点击整卡打开设置）。
- `src/components/ChatView.tsx`：聊天主区。负责主聊天 + 副窗口 split、拖拽 AI 气泡的状态机（ghost card / drop zones / body class）、磨砂背景、分隔条调宽、minimap 挂载。
- `src/components/MessageBubble.tsx`：单条消息。AI 气泡右上角有独立的 `.msg-drag-handle`（星星 SVG），**点击 = 切换 `highlighted`；按住拖拽 = 打开副窗口追问**。`.msg-bubble-block.highlighted` 渲染橙金色高光态，星星按钮 `.active` 填色。
- `src/components/Composer.tsx`：主输入框。`.composer-dock` 把 `.composer-box`（圆角输入区）和 `.btn-minimap-toggle`（外置的总览按钮）并排，底边对齐。
- `src/components/SidePanel.tsx`：副窗口。锚点预览 + 加入主上下文开关 + 副链消息 + 精简 `.side-composer`（共享 `.composer-box`，`max-width: none`）。
- `src/components/SettingsModal.tsx`：设置弹窗。左侧导航（账户 / API 设置 / 页面 UI / 关于）+ 右侧内容面板；账户页可编辑头像 + 显示名。
- `src/components/ThreadMinimap.tsx`：**高光概览**抽屉。从主输入框下方上滑展开；纵向时间轴（主轴 + 分支次轴 + 节点圆点）。主链节点按「高光 / 非高光」分两档渲染：高光 AI 回答以 `.minimap-pane-node.highlight` 展示摘要；其他节点用 `.minimap-pane-node.compact` 仅保留一个小圆点。

### Lib / Store
- `src/store/useAppStore.ts`：zustand 全局 store，所有业务状态都在这里。
- `src/lib/db.ts`：SQLite 读写（含 `updateMessageBranchLabel`）。
- `src/lib/chat.ts`：流式请求前端封装。
- `src/lib/tree.ts`：消息树工具函数（`buildMainContext` / `buildSideContext` / `getChainToNode` / `buildChildrenMap` / `getLatestMainLeaf` 等）。
- `src/lib/settings.ts`：设置持久化 + API Key 读写（Tauri 运行时检测降级到 localStorage）。
- `src/lib/summary.ts`：调 LLM 生成会话标题 / 节点标题 / 分支标题。
- `src/lib/avatar.ts`：头像处理（文件 → 居中裁正方形 → 256×256 缩放 → data URL；`avatarInitials` 生成 2 字缩写占位）。
- `src/lib/types.ts`：共享类型。
- `src/styles.css`：全局样式（CSS 变量 `--bg / --primary / --primary-soft / --border / --muted / --ios-ease / --app-font-size / --bottom-bar-height / --sidebar-width` 等）。

### Rust / Tauri
- `src-tauri/src/lib.rs`：Rust 入口 + SQLite migrations + 命令注册。
- `src-tauri/src/chat.rs`：流式聊天（SSE 解析，emit `chat://delta|done|error/<request_id>`）。
- `src-tauri/src/secrets.rs`：Keychain 命令（`secret_has / secret_set / secret_delete`）。
- `src-tauri/src/error.rs`：AppError。
- `src-tauri/tauri.conf.json`：Tauri 配置（macOS overlay titlebar）。
- `src-tauri/capabilities/default.json`：权限清单。
- `scripts/gen-icons.mjs`：占位图标生成脚本。

## 4. 数据模型

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  model TEXT,
  provider TEXT,
  base_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  parent_id TEXT,
  role TEXT NOT NULL,                          -- 'system' | 'user' | 'assistant'
  content TEXT NOT NULL,
  is_branch_root INTEGER NOT NULL DEFAULT 0,   -- 1 = 副问答链根
  branch_label TEXT,
  created_at INTEGER NOT NULL
);
```

v2 迁移已落地：`messages.include_in_main INTEGER NOT NULL DEFAULT 0`。
v3 迁移已落地：`messages.highlighted INTEGER NOT NULL DEFAULT 0`（只对 role='assistant' 的消息生效，用于「高光关键答复」标记）。
v4 迁移已落地：`messages.node_label TEXT`（持久化节点提炼标题；切会话后可直接读取，不必每次重新总结）。

## 5. Settings 类型（当前最新）

```ts
interface Settings {
  provider: string;
  base_url: string;
  model: string;
  temperature: number;
  system_prompt: string;
  ui_font_size: number;     // 13–20，默认 16
  user_name: string;        // 默认 "本地用户"
  user_avatar: string;      // data URL，空串表示无头像
}
```

- `ui_font_size` 通过 `<div className="app" style={{ "--app-font-size": ... }}>` 注入 CSS 变量，全局字号跟随。
- `user_avatar` 以 data URL 存于 settings.json；`fileToAvatarDataURL` 会居中裁正方形 + 缩放至 256×256 + 根据原 mime 选 png/jpeg 编码，体积可控。

## 6. 重要产品决策（用户已确认）

- UI 风格：清新、简洁、扁平化，浅色调（参考 Claude / ChatGPT）。
- 只接入 OpenAI 兼容接口（可自定义 Base URL）。
- 本地 SQLite 持久化；不接入任何账号系统（用户名 / 头像仅本机存储）。
- **副窗口模式**：同一时间只开一个副窗口；切到新锚点会关闭旧副窗口但保留历史。
- **副问答是否并入主上下文**：每条副链独立开关，用户手动决定（默认关闭）。
- **Minimap 交互模式**：主输入框右侧独立按钮 → 从下方升起纵向时间轴总览 → 再点 / ESC / 面板 × 关闭。

## 7. UI 布局与约束（最新，这是本次会话大量打磨后的状态）

### 7.1 应用级
- CSS 变量体系：`--bg #f7f7f5`、`--surface #fff`、`--surface-soft #fafaf8`、`--primary / --primary-soft`（橙棕系）、`--border`、`--ios-ease cubic-bezier(0.22, 0.8, 0.28, 1)`、`--sidebar-width 260px`、`--bottom-bar-height 76px`、`--app-font-size`。
- iOS 风缓动统一用 `transition: ... var(--ios-ease)`。
- 所有主要浮层、抽屉、动画都要有 `prefers-reduced-motion` 兜底（保留骨架，必要时简化）。

### 7.2 左侧栏
- `.sidebar-shell`：可折叠容器；`.open` / `.closed` 控制宽度与透明度。
- 边缘触发条 `.sidebar-edge-handle`：圆形按钮，左右中点凸起，`<` / `>` 旋转动画。
- 底部 `.sidebar-footer`：**用户卡片**（不是按钮）
  - 圆形头像（36×36，橙渐变；上传后是 `<img>` cover）
  - 用户名（水平居中对齐头像，`line-height: 1`）
  - 右侧 `›` 轻微位移箭头
  - 整块点击打开设置弹窗

### 7.3 主聊天窗
- `.chat`：`position: relative; overflow: hidden;`（作为 composer / minimap / drop zones / drag-backdrop 的定位祖先）。
- `.chat-scroll`：唯一滚动容器；`.chat-inner { max-width: 920px; padding: 26px 26px 140px }`（140 给悬浮 composer 让出空间）。
- 消息气泡：用户消息右对齐、`max-width: 560px`；AI 消息 `max-width: 720px`。`.msg-content` 用 `overflow-wrap: break-word; display: block; width: auto;` 避免短消息竖排。
- AI 气泡右上角 `.msg-drag-handle`（星星图标）：同时承担**点击 = 标记高光 / 拖拽 = 打开副窗口**两种交互；开启 `canDrag && !streaming` 时渲染。点击判定在 `ChatView.handleHandleMouseDown` 里，通过是否越过 `DRAG_THRESHOLD_PX=6` 区分。
- 高光态：`.msg-bubble-block.highlighted` 给 AI 气泡加橙金色渐变背景 + 描边 + 阴影；`.msg-drag-handle.active` 把星星填色并加金色光圈。

### 7.4 悬浮输入框（主窗口）
- `.composer`：`position: absolute; inset 用 left/right/bottom; z-index: 10; pointer-events: none`；背景是透明 → 底色的垂直渐变（ChatGPT 风的「底部隐没」观感）。
- `.composer > *` 设回 `pointer-events: auto`，只让输入框本身和 warning 接收事件。
- `.composer-dock`：`max-width: 964px`（920 + 10 gap + 34 按钮），居中；把 `.composer-box` 和 `.btn-minimap-toggle` 并排。
- `.composer-box`：`max-width: 920px`（与 `.chat-inner` 对齐）；`border-radius: 22px`、`padding: 8px 8px 8px 16px`、`background: var(--surface)`、`box-shadow: 0 8px 24px rgba(40,44,48,0.08), 0 2px 6px rgba(40,44,48,0.04)`、`:focus-within` 加深 + 橙色发光环。
- textarea：`line-height: 22px; padding: 6px 0; min-height: 34px`，单行时高度 = 34（与发送按钮等高）；`align-items: flex-end` 让多行时按钮贴底。
- `.btn-send / .btn-stop`：34×34 圆形；发送按钮橙渐变 + 阴影；停止按钮浅红。
- `.btn-minimap-toggle`：34×34 圆形，`margin-bottom: 8px` 用来抵消 `.composer-box` 的 8px 下内边距，使其底边与发送箭头底边平齐；`open` 态用 `var(--primary-soft)` + 棕字；SVG chevron 在 `open/closed` 间 0°↔180° 旋转。
- 占位文案：主窗口 `有问题，尽管问`；副窗口 `问个小问题`。

### 7.5 副窗口（SidePanel）
- `.side-panel { position: relative; }`（作为 side-composer 的定位祖先）。
- `.side-inner { padding-bottom: 120px }` 给悬浮输入框让位。
- `.side-composer .composer-box { max-width: none; }` 让副窗口输入框撑满副窗口宽度；其他样式（圆角、padding、按钮大小、字号）全部继承主窗口 `.composer-box` 规则。
- 副窗口宽度可拖：`ChatView` 内有 `.side-resizer`，`sideWidth` 持久化到 localStorage。
- 拖动分隔条时 body 加 `.resizing-side`。

### 7.6 Minimap（高光概览）
- 触发按钮：主输入框右侧外置的 `.btn-minimap-toggle`（见 7.4）。title/aria 均为「高光概览」。
- 面板 `.minimap-shell`：`position: absolute; right: max(26px, calc(50% - 482px)); bottom: 100px; width: min(300px, calc(100% - 52px)); height: min(440px, calc(100% - 160px)); z-index: 15;`
  - 宽屏时右边缘与触发按钮对齐；窄屏时贴右 18px。
  - `@media (max-width: 1120px)`：`width: min(280px, calc(100% - 36px)); height: min(420px, calc(100% - 140px))`。
  - `.closed → .open`：`opacity 0→1`、`translateY(18px)→0`，`0.34s var(--ios-ease)` 从下方上滑。
- 面板本体 `.minimap-float-pane`：半透明白 + `backdrop-filter: blur(14px) saturate(1.05)` + 大阴影。
- 头部 `.minimap-pane-header`：标题「高光概览」+ 可选 `.minimap-count` 徽标（高光条数） + 右上角 `.minimap-close`（×）；`Esc` 键也可关闭。
- **时间轴视图（新版）**：`ThreadMinimap` 只渲染主链里 `role === "assistant"` 的消息（不再显示用户输入，也完全不展示分支条目；分支入口仍在 AI 气泡下方的 `.branch-chip` 里）。
  - `.minimap-timeline` 左侧 20px 处有主轴线（`rgba(217,123,70,.34) → .08` 渐变）。
  - 每条 AI 回答都渲染成 `.timeline-item`，两档：
    - `.timeline-item.default`：普通 AI 回答 → 8px 灰点 + `#f5f3ee` 中性卡（边框 `#e8e5de`），内含 `#idx` 徽标和最多 3 行摘要。
    - `.timeline-item.highlight`：高光 AI 回答 → 11px 橙色实心点 + `.timeline-card` 换成 `--primary-soft` 底（边框 `#efdcce`），`#idx` 右侧附一个小 `★`。
  - hover：小点暖橙放大，卡片轻微右移 1px。
- 点击行为：**只滚动，不改主链状态**。`scrollToMessage(id)` 直接走 `document.getElementById("msg-"+id)?.scrollIntoView({ behavior: "smooth", block: "center" })`；不再调用 `jumpToMessage`，避免把 `currentNodeId` 改到历史节点导致主窗口 thread 被截断、minimap 里看起来下方节点"消失"。`jumpToMessage` / `jumpToLatest` 在 store 里保留但当前无调用方。
- 摘要：`ensureNodeLabel` 在 minimap 打开时对所有 `aiItems` 调用（流式中的跳过），保证每条 AI 回答都有提炼标题。
- 高光气泡底色：不再在 `.msg-bubble-block` 外包装加背景条。改为在 `.msg-row.assistant .msg-bubble-block.highlighted .msg-content` 上直接把卡片自身染成 `#fdeede` 浅橙 + 边框 `#f2d9c3`，文字 `#3a2b1e`；色系与 `.btn-minimap-toggle.open`、`.branch-chip.active`、`.sidebar-item.active` 统一。

### 7.7 拖拽交互（AI 气泡 → 副窗口追问） + 高光点击
- 触发点：**仅** `.msg-drag-handle`（AI 气泡右上角星星按钮），其余区域可正常选中文字。
- 阈值：`DRAG_THRESHOLD = 6px`。鼠标抬起时：
  - 未越过阈值 → 视为**点击**，调用 `toggleHighlight(messageId)` 切换 `messages.highlighted`。
  - 越过阈值 → 正常拖拽流程，落在 `data-drop-zone="main" | "side"` 上时 `openSidePanel`。
- 状态：`ChatView` 内的 `dragState`（id / x / y / width / height / preview / over）。
- 视觉：
  - 被拖气泡 `.msg-bubble-block.being-dragged { opacity: 0.35; transform: scale(0.985) }`。
  - 浮动卡片 `.drag-ghost`（`position: fixed; z-index: 9999`，锁在鼠标抓取点）。
  - `body.dragging-bubble { cursor: grabbing; user-select: none; }`。
  - **磨砂背景** `.drag-backdrop`：`position: absolute; inset: 0; z-index: 35; pointer-events: none;`；`backdrop-filter: blur(4px) saturate(0.98)`；主区域底色 `rgba(247,247,245,0.22)`，副区域 `.drag-backdrop.side` `rgba(250,250,248,0.26)`。只在 `dragState` 有值时挂载；副窗口版本仅在 `sidePanel` 打开时挂载。
- 投放区：
  - 副窗口关闭：主窗口右侧出现 `.anchor-drop-main`（虚线框，`z-index: 40`）。
  - 副窗口打开：副窗口内部出现 `.anchor-drop-side` 虚线框。
  - `detectZone` 使用 `document.elementFromPoint`；磨砂背景 `pointer-events: none` 不会干扰。
- 松开：调用 `openSidePanel(anchorMessageId)` 或在现有副窗口里加一条锚点。

### 7.8 设置弹窗
- `.settings-modal`：`width: min(920px, calc(100vw - 40px)); height: min(640px, calc(100vh - 60px)); grid-template-columns: 220px 1fr;`
- 左侧 `.settings-rail`：顶部圆形 `×` 关闭按钮；垂直导航 `.settings-nav-item`（emoji 图标 + label），活跃态用 `--primary-soft` + 棕字。
- 分类：`account / api / ui / about`。
- 右侧 `.settings-content`：`.settings-content-header` 标题 + `.settings-content-body` 表单 + `.settings-content-footer` 保存/取消（`about` 页不显示 footer）。
- 账户页：头像（64×64）+ 上传 / 移除按钮 + 显示名文本框。上传走 `fileToAvatarDataURL`。
- API 页：provider 预设、Provider ID、Base URL、Model、Temperature、System Prompt、API Key（走 Keychain）。
- UI 页：字号 range + number 双控件，绑定 `ui_font_size`。
- 关于页：纯展示，版本号 / 运行栈。

## 8. 已完成阶段（摘要）

### 阶段一：基础 GPT 客户端（完成）
Tauri 骨架、设置弹窗、Keychain、SQLite、流式对话、中止、自动标题、浏览器降级。

### 阶段二：内联小问题分支（已被 v2 替代）

### 阶段三 v1：Minimap 初版（已被折叠版替代）

### UI 重构：浅色扁平化 + 左栏固定（完成）

### 阶段三 v2：副窗口分支 + 折叠 Minimap（完成）
- DB：`messages.include_in_main` v2 迁移；`updateIncludeInMainForIds` 批量切整条副链。
- Store：`sidePanel` 状态机 + `minimapOpen`；主/副消息发送与取消、`openSidePanel / closeSidePanel / setSideIncludeInMain`。
- 上下文构造：`buildMainContext`（主链 + 已并入的整条副链）+ `buildSideContext`（system + 主链到 anchor + 副链 root→leaf）。

### 阶段三 v2 稳定性补丁（完成）
- Migration checksum 修复（已发布的 SQL 一字不能改）。
- 流式滚动抖动修复（`scrollIntoView smooth` → 容器 `scrollTop = scrollHeight` + 贴底检测）。
- 双流并发性能（rAF 节流 + `React.memo` + `useMemo` markdown 子树 + 提升插件常量）。
- 发送错误可见化（Composer 内显示 `发送失败：...`）。

### 本轮会话：UI / 交互全面打磨（完成）
**左栏**
- 折叠 / 展开（圆形边缘按钮，中点凸起 `<` / `>`，iOS 风缓动）。
- 同步滑动动画；收起后右侧不留空白（`.chat-split` 用 `flex: 1`）。
- 历史删除按钮去掉 `confirm()`。
- 底部从「⚙ 设置」长按钮 → **用户卡片**（头像 + 用户名，整块点击打开设置）。

**主聊天 & 副窗口**
- 用户消息右对齐、气泡右贴头像、不撑满整行。
- 副窗口与主窗口之间可拖的分隔条，宽度持久化。
- 两边的消息气泡都不再因短内容竖排；对齐、间距一致。

**输入框**
- 去掉底部背景矩形 → 悬浮圆角输入框 + 底部渐隐。
- `.composer` 改为 `position: absolute`，让聊天内容填满整个高度，输入框悬浮其上。
- 主 / 副窗口输入框共用 `.composer-box` 样式（圆角、阴影、按钮尺寸一致）。
- 主窗口宽度对齐 `.chat-inner`（920px 居中）；副窗口撑满副窗口。
- 占位文案：主 `有问题，尽管问`；副 `问个小问题`。

**拖拽卡片交互**
- 移除 AI 气泡底部「在侧窗口追问」按钮，改为拖拽卡片。
- AI 气泡右上角独立 `.msg-drag-handle`（实心 SVG 图标），唯一拖拽触发点。
- 拖拽时 ghost card 锁在鼠标抓取点。
- 副窗口关/开两种状态都有对应的虚线投放区。
- 拖拽时加 `.drag-backdrop` 磨砂背景（轻度 `blur(4px) saturate(0.98)`），让投放区更突出。

**对话总览**
- 从右侧抽屉 → 主输入框下方升起的纵向时间轴。
- 触发按钮从边缘移到输入框右侧外部（独立圆形，34×34，与发送箭头等高）。
- 面板较窄（400px），右对齐触发按钮；毛玻璃浮层 + 纵向轴 + 节点圆点 + 分支次级轴。
- 面板头部 `×` 关闭；Esc 关闭仍保留。

**设置弹窗**
- ChatGPT 风双栏布局：左侧导航（账户 / API / UI / 关于）+ 右侧内容。
- 账户页：头像上传 / 移除、显示名编辑（仅本机保存）。`Settings` 里加了 `user_name / user_avatar`。
- 账户信息同步到左栏用户卡片。

**体系变量**
- `--bottom-bar-height: 76px`（曾用于统一底部条高度，现仅作用于 `.sidebar-footer`；悬浮 composer 不受约束）。
- `--ios-ease`：统一过渡缓动。

## 9. 运行 / 验证指令

- 开发运行（推荐）：`npm run tauri:dev`
- 仅前端构建：`npm run build`
- 前端类型检查：`npx tsc --noEmit`
- Rust 编译检查：`cargo check --manifest-path src-tauri/Cargo.toml`（沙箱受限时需 `required_permissions: ["all"]`）
- Rust 工具链：在 `~/.cargo/env` 里，shell 前请 `source "$HOME/.cargo/env"`
- 每次实质改动后至少跑 `npx tsc --noEmit` + `ReadLints src/`。

## 10. 关键不变式（后续 agent 改东西时不要破坏）

### 业务逻辑
- 主请求上下文：主链按时间 → 每个主 assistant 下按时间插入 `is_branch_root=1 && include_in_main=1` 的整条副链 → 主链最新 user 已在链尾，不额外追加。
- 副请求上下文：system → 主链根→anchor（含）→ 副链 root→latestSideMessage（含）。
- 同一副问答链的所有节点 `include_in_main` 必须整链同步（用 `updateIncludeInMainForIds`）。
- 同一时刻只允许一个副窗口实例（`sidePanel: SidePanelState | null`）；切副链要先 `cancelSideStream`。

### DB
- **铁律**：`src-tauri/src/lib.rs` 里任何已发布版本（v1、v2 ……）的 `Migration.sql` 字符串**一个字节都不能改**（包括缩进、空格、注释）。schema 变更一律用新增版本号的 Migration。违反会触发 `migration N was previously applied but has been modified`。

### 流式性能
- 任何新增的流式回调（SSE / WebSocket 等）都应走 rAF 节流模式，不要每个 chunk 直接 `setState`，参考 `sendMainMessage` 的 `pending / rafId / flush` 结构。
- 自动滚动：不要用 `element.scrollIntoView({ behavior: "smooth" })` 做流式跟随。用容器 `scrollTop = scrollHeight` + 贴底检测模式。
- 节点标题 AI 总结（`ensureNodeLabel`）要跳过正在流式的消息，避免提前对不完整内容做摘要。

### UI / 样式
- 悬浮 composer 绝不能变成 flex 流中的项（会重新挤占聊天高度）。保持 `position: absolute + pointer-events: none + 子元素 pointer-events: auto`。
- 主窗口 `.composer-box max-width: 920px` 必须与 `.chat-inner max-width: 920px` 对齐。如要改宽度，两处同步。
- 副窗口复用 `.composer-box` 全部样式，只通过 `.side-composer .composer-box { max-width: none; }` 解除宽度约束。
- AI 气泡的拖拽触发**只能**从 `.msg-drag-handle` 发起，不能回到整个气泡监听（会破坏选中文字的体验）。该手柄既是「拖拽副窗口」触发器也是「高光点击」触发器，阈值判定在 `handleHandleMouseDown` 的 mouseup 里，不要简化掉 `started` 判定。
- `messages.highlighted` 只对 `role === "assistant"` 的消息有意义；`toggleHighlight` 会拒绝其他 role。
- `.drag-backdrop` 必须 `pointer-events: none`，否则 `document.elementFromPoint` 投放区检测失效。
- 所有颜色走 CSS 变量；不要硬编码浅色主题色。字号走 `--app-font-size` 或 `rem`。

## 11. 下一步候选方向（等用户确认）

- [ ] Minimap 时间轴支持高亮当前正在看的节点（滚动位置联动）。
- [ ] 副窗口可拖拽改宽的最小值 / 最大值精调，并与 minimap 右对齐计算联动。
- [ ] 副链删除 / 重命名 / 折叠 UI。
- [ ] 多个 `include_in_main=1` 副链同时注入主上下文时的 token 预算保护。
- [ ] 流式 SSE 网络失败的重试策略 + 更细错误分类。
- [ ] 导出 / 导入会话（JSON 或 Markdown）。
- [ ] 账户页支持快捷的「清空所有会话」 / 「导出 / 导入设置」等本地操作。
- [ ] 设置弹窗导航图标升级为 SVG 线条（目前是 emoji）。
- [x] 清理已无引用的旧 CSS（已清理：`.branch-btn` / `.composer-target` / `.modal-footer` / `.thread-indicator` / `.sidebar-footer .btn-ghost`；styles.css 1883 → 1803 行）。
- [x] 星星高光按钮 + 高光概览（本次会话完成：v3 迁移 `messages.highlighted`，点击星星切换高光态，ThreadMinimap 只对高光回答展示摘要）。

## 12. 给接力 agent 的第一步建议

1. 读本文件全文。
2. 读 `src/store/useAppStore.ts`（副窗口状态机）、`src/lib/tree.ts`（上下文构造）、`src/components/ChatView.tsx`（拖拽状态机）、`src/components/SidePanel.tsx`、`src/components/ThreadMinimap.tsx`、`src/components/SettingsModal.tsx`、`src-tauri/src/lib.rs`（migrations）。
3. 在做任何改动前确认不会破坏 §10 的「关键不变式」。
4. 用户下一个需求到了就按其描述推进；如果让你延续之前的方向，从 §11 挑一项或询问确认。
5. 每次实质改动后跑 `npx tsc --noEmit` + `ReadLints`（Rust 改了再加 `cargo check`）。
6. 每次回复开头简短告知「已完成 / 正在做 / 下一步」，避免用户再丢上下文。
