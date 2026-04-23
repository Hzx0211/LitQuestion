# Side Panel Branching + Collapsible Minimap — 执行计划

> 这是项目下一阶段（阶段三重构）的正式执行计划。
> 与 `AGENT_HANDOFF.md` 配合使用；接力 agent 按本文件顺序实现。

## 目标

1. 把“切换式分支”改为“主问答 + 右侧副窗口共存”的模式。
2. 副问答可选地“并入主上下文”。
3. Minimap 改为右下角小按钮，点击展开浮层总览。

## 数据模型变更（v2 migration）

在 `src-tauri/src/lib.rs` 的 migrations 里新增 v2：

```sql
ALTER TABLE messages ADD COLUMN include_in_main INTEGER NOT NULL DEFAULT 0;
```

- 该字段只在副问答节点（`is_branch_root = 1` 的链及其后代）上有意义
- 同一条副问答链里，所有节点的 `include_in_main` 统一由“副窗口顶部开关”整条切换（实现时用一次 `UPDATE ... WHERE conversation_id=? AND <在该链后代集合内>`）

前端 `Message` 类型同步加 `include_in_main: boolean`；`db.ts` 读写同步。

## Store 变更（`src/store/useAppStore.ts`）

新增字段：

```ts
sidePanel: {
  anchorId: string | null;        // 锚点：主链上某条 assistant 消息
  branchRootId: string | null;    // 当前副问答链的根（is_branch_root=1 的那条）
  currentNodeId: string | null;   // 副窗口里当前叶子（续写用）
  streamingMessageId: string | null;
  activeStream: ChatStreamHandle | null;
  includeInMain: boolean;         // 当前副问答是否并入主
} | null;  // null 表示副窗口关闭
minimapOpen: boolean;
```

新增 actions：

- `openSidePanel(anchorMessageId: string, branchRootId?: string)` — 打开/切换副窗口；如无 `branchRootId` 则下次发送时新建
- `closeSidePanel()`
- `sendMainMessage(text: string)`
- `sendSideMessage(text: string)`
- `cancelMainStream()` / `cancelSideStream()`
- `setSideIncludeInMain(value: boolean)` — 写 DB + 更新 store + 若开启且主窗口正在请求则不需重做，只影响后续发送
- `toggleMinimap()`

移除/改造：

- 删除旧的 `composeParentId` + 内联 chip 切换逻辑（由副窗口替代）

## 上下文构造（`src/lib/tree.ts` 扩展）

新函数：

```ts
buildMainContext(messages: Message[], system: string | null): ChatMessage[]
buildSideContext(messages: Message[], anchorId: string, branchLeafId: string, system: string | null): ChatMessage[]
```

### `buildMainContext` 逻辑
1. 先取“主链”：根 -> 当前主链叶子。主链定义为 `is_branch_root=0` 且所有祖先都不是副问答链节点。
2. 按时间顺序遍历主链，每遇到一条 `role='assistant'` 的主链消息 M：
   - 找 M 的直接子节点中 `is_branch_root=1 && include_in_main=1` 的所有链
   - 按 `created_at` 排序后整链插入（user/assistant 交替，保留文本）
3. 可选的 system prompt 作为第一条

### `buildSideContext` 逻辑
1. system prompt（若有）
2. 主链：根 -> `anchorId`（含）
3. 该副问答链：`branchRoot` 的祖先停在 `anchorId`，链内从 `branchRoot` 到 `branchLeafId`（含）
4. （不合并其它副问答链）

## UI 变更

### 布局（`src/components/ChatView.tsx`）
- 用 flex 横向布局：`MainChatPanel` + （`sidePanel != null` 时渲染）`SidePanel`
- `SidePanel` 宽 `420px`，左侧有 1px 分隔线，内部也是“消息区 + 输入框”上下结构
- 主面板和副面板各自独立滚动

### 新组件 `src/components/SidePanel.tsx`
- 顶部：锚点预览（截取 anchor assistant 消息前 80 字）+ `加入主上下文` Switch + 关闭按钮
- 中间：该副问答链消息（复用 `MessageBubble`）
- 底部：`Composer` 的精简版（只发送副消息）

### 锚点入口（`MessageBubble` footer 或 `ChatView` 内）
- 每条主 assistant 消息下方：
  - 按钮 `在侧窗口追问` → `openSidePanel(id)` 并清空 `branchRootId`（下次发送会新建）
  - 若该节点下已有副问答链，渲染 `分支 1 · 分支 2 · …` chip，点击 → `openSidePanel(id, branchRootId)` 载入该链

### Minimap 折叠（`src/components/ThreadMinimap.tsx`）
- 折叠态：右下 `position: fixed`，`36x36` 圆按钮，图标用简单的 3 条横线或小树图形（纯 SVG）
- 展开态：点击按钮 → 浮层（居中或右侧抽屉），尺寸 `min(560px, 90vw) × min(720px, 80vh)`
- 展开浮层内容：
  - 标题 `对话总览`
  - 左栏主链节点列表；右栏每个节点下方列出副问答链（带 include_in_main 小圆点）
  - 点击任意节点 → 关闭浮层 + `jumpToMessage` 或 `openSidePanel`
  - ESC / 点击遮罩关闭

## 清理任务

- 删 `src/store/useAppStore.ts` 里 `composeParentId` 相关逻辑
- 删 `src/components/ChatView.tsx` 里通过 chip 切换当前 thread 的老逻辑
- `src/components/Composer.tsx` 里移除 `composer-target` 与 `回到最新` 按钮
- 样式里删除或保留不碍事的 `.branch-chip/.branch-list` 可留作副问答入口样式复用

## 验证清单

1. `npm run build`（tsc + vite build）零错误
2. `cargo check --manifest-path src-tauri/Cargo.toml` 零错误
3. `ReadLints src/` 零告警
4. 手动用例：
   - 新对话 → 发几轮主问答 → 在某 assistant 下点“在侧窗口追问” → 副窗口打开 → 发 2 轮
   - 关闭副窗口 → 主问答继续 → 同一锚点再次点 → 看到刚才的分支 chip → 点进去能继续写
   - 打开 `加入主上下文` → 主窗口再发一句 → 观察控制台请求 body 里包含副问答消息
   - Minimap 默认小按钮 → 点击展开 → 点击某条跳转生效 → ESC 关闭
   - 主面板 + 副面板各自滚动互不干扰
5. 关闭 app 重启，数据仍在；`include_in_main` 状态保留

## 风险与备注

- 副窗口流式与主窗口流式互不冲突（不同 `request_id`，后端 `ChatState` 已支持并发）
- 切换副问答锚点时若副窗口还在流式：先 `cancelSideStream` 再切换，避免错写父节点
- `buildMainContext` 要注意性能：消息数多时避免 O(n²)；先建 `childrenMap` 再 O(n) 扫描
