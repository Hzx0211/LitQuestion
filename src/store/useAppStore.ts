import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Conversation, Message, Settings } from "../lib/types";
import { DEFAULT_SETTINGS } from "../lib/types";
import * as db from "../lib/db";
import { readSettings, hasApiKey } from "../lib/settings";
import { streamChat, type ChatStreamHandle, type ChatMessage } from "../lib/chat";
import {
  summarizeBranchTitle,
  summarizeConversationTitle,
  summarizeNodeTitle,
} from "../lib/summary";
import {
  buildMainContext,
  buildSideContext,
  collectBranchDescendants,
  getLatestMainLeaf,
  getLatestMessage,
} from "../lib/tree";

export interface SidePanelState {
  anchorId: string;
  branchRootId: string | null;
  currentNodeId: string | null;
  streamingMessageId: string | null;
  activeStream: ChatStreamHandle | null;
  includeInMain: boolean;
}

interface AppState {
  ready: boolean;
  settings: Settings;
  hasKey: boolean;
  conversations: Conversation[];
  currentId: string | null;
  messages: Message[];
  nodeLabels: Record<string, string>;
  nodeLabelLoading: Record<string, boolean>;
  currentNodeId: string | null;
  streamingMessageId: string | null;
  activeStream: ChatStreamHandle | null;
  sidePanel: SidePanelState | null;
  minimapOpen: boolean;

  init: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  selectConversation: (id: string | null) => Promise<void>;
  newConversation: () => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  jumpToMessage: (id: string) => void;
  jumpToLatest: () => void;

  sendMainMessage: (text: string) => Promise<void>;
  cancelMainStream: () => Promise<void>;

  openSidePanel: (anchorMessageId: string, branchRootId?: string | null) => void;
  closeSidePanel: () => Promise<void>;
  sendSideMessage: (text: string) => Promise<void>;
  cancelSideStream: () => Promise<void>;
  setSideIncludeInMain: (value: boolean) => Promise<void>;

  toggleMinimap: () => void;
  setMinimapOpen: (open: boolean) => void;
  ensureNodeLabel: (id: string) => Promise<void>;
  toggleHighlight: (id: string) => Promise<void>;
}

function buildSystem(settings: Settings): string | null {
  const t = settings.system_prompt?.trim();
  return t ? t : null;
}

function labelsFromMessages(messages: Message[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const m of messages) {
    const label = m.node_label?.trim();
    if (label) labels[m.id] = label;
  }
  return labels;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  hasKey: false,
  conversations: [],
  currentId: null,
  messages: [],
  nodeLabels: {},
  nodeLabelLoading: {},
  currentNodeId: null,
  streamingMessageId: null,
  activeStream: null,
  sidePanel: null,
  minimapOpen: false,

  async init() {
    const [settings, convs] = await Promise.all([
      readSettings(),
      db.listConversations(),
    ]);
    const hasKey = await hasApiKey(settings.provider);
    set({ ready: true, settings, hasKey, conversations: convs });
    if (convs.length > 0) {
      await get().selectConversation(convs[0].id);
    }
  },

  async refreshSettings() {
    const settings = await readSettings();
    const hasKey = await hasApiKey(settings.provider);
    set({ settings, hasKey });
  },

  async selectConversation(id) {
    await get().cancelSideStream();
    if (!id) {
      set({
        currentId: null,
        messages: [],
        nodeLabels: {},
        nodeLabelLoading: {},
        currentNodeId: null,
        sidePanel: null,
      });
      return;
    }
    const messages = await db.listMessages(id);
    const latest = getLatestMainLeaf(messages) ?? getLatestMessage(messages);
    set({
      currentId: id,
      messages,
      nodeLabels: labelsFromMessages(messages),
      nodeLabelLoading: {},
      currentNodeId: latest?.id ?? null,
      sidePanel: null,
    });

    const conv = get().conversations.find((c) => c.id === id);
    const firstMainUser = messages.find(
      (m) => m.role === "user" && m.is_branch_root !== 1
    );
    if (conv && firstMainUser) {
      const firstQuestion = firstMainUser.content.trim();
      const fallbackTitle = firstQuestion.slice(0, 24);
      const shouldRefine =
        conv.title === "新对话" || (fallbackTitle.length > 0 && conv.title === fallbackTitle);
      if (shouldRefine) {
        const settings = get().settings;
        void (async () => {
          const aiTitle = await summarizeConversationTitle(settings, firstQuestion);
          if (!aiTitle || aiTitle === conv.title) return;
          await db.renameConversation(id, aiTitle);
          const convs = await db.listConversations();
          set({ conversations: convs });
        })();
      }
    }
  },

  async newConversation() {
    const { settings } = get();
    const id = nanoid();
    await db.createConversation({
      id,
      title: "新对话",
      model: settings.model,
      provider: settings.provider,
      base_url: settings.base_url,
    });
    const convs = await db.listConversations();
    set({
      conversations: convs,
      currentId: id,
      messages: [],
      nodeLabels: {},
      nodeLabelLoading: {},
      currentNodeId: null,
      sidePanel: null,
    });
    return id;
  },

  async deleteConversation(id) {
    await db.deleteConversation(id);
    const convs = await db.listConversations();
    const { currentId } = get();
    const nextCurrentId = currentId === id ? convs[0]?.id ?? null : currentId;
    const nextMessages = nextCurrentId ? await db.listMessages(nextCurrentId) : [];
    const nextLatest = getLatestMainLeaf(nextMessages) ?? getLatestMessage(nextMessages);
    set({
      conversations: convs,
      currentId: nextCurrentId,
      messages: nextMessages,
      nodeLabels: labelsFromMessages(nextMessages),
      nodeLabelLoading: {},
      currentNodeId: nextLatest?.id ?? null,
      sidePanel: null,
    });
  },

  async renameConversation(id, title) {
    await db.renameConversation(id, title);
    const convs = await db.listConversations();
    set({ conversations: convs });
  },

  jumpToMessage(id) {
    set({ currentNodeId: id });
  },

  jumpToLatest() {
    const latest = getLatestMainLeaf(get().messages) ?? getLatestMessage(get().messages);
    set({ currentNodeId: latest?.id ?? null });
  },

  async sendMainMessage(text) {
    const { currentId, settings, messages, currentNodeId } = get();
    let convId = currentId;
    if (!convId) {
      convId = await get().newConversation();
    }

    const parent = currentNodeId ?? null;
    const userMsg = await db.insertMessage({
      id: nanoid(),
      conversation_id: convId,
      parent_id: parent,
      role: "user",
      content: text,
    });
    const assistantMsg = await db.insertMessage({
      id: nanoid(),
      conversation_id: convId,
      parent_id: userMsg.id,
      role: "assistant",
      content: "",
    });

    set({
      messages: [...get().messages, userMsg, assistantMsg],
      streamingMessageId: assistantMsg.id,
      currentNodeId: assistantMsg.id,
    });
    void get().ensureNodeLabel(userMsg.id);

    const convAfter = get().conversations.find((c) => c.id === convId);
    if (convAfter && convAfter.title === "新对话") {
      void (async () => {
        const aiTitle = await summarizeConversationTitle(settings, text);
        const title = aiTitle ?? (text.trim().slice(0, 24) || "新对话");
        await db.renameConversation(convId!, title);
        const convs = await db.listConversations();
        set({ conversations: convs });
      })();
    }

    const history: ChatMessage[] = buildMainContext(
      [...messages, userMsg],
      userMsg.id,
      buildSystem(settings)
    );

    let acc = "";
    let pending = "";
    let rafId: number | null = null;
    const flush = () => {
      rafId = null;
      if (!pending) return;
      acc += pending;
      pending = "";
      const text = acc;
      set({
        messages: get().messages.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: text } : m
        ),
      });
    };
    const handle = streamChat({
      provider: settings.provider,
      base_url: settings.base_url,
      model: settings.model,
      messages: history,
      temperature: settings.temperature,
      onDelta(piece) {
        pending += piece;
        if (rafId == null) {
          rafId = requestAnimationFrame(flush);
        }
      },
      async onDone() {
        if (rafId != null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (pending) {
          acc += pending;
          pending = "";
        }
        const finalText = acc;
        await db.updateMessageContent(assistantMsg.id, finalText);
        void get().ensureNodeLabel(assistantMsg.id);
        set({
          streamingMessageId: null,
          activeStream: null,
          currentNodeId: assistantMsg.id,
          messages: get().messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: finalText } : m
          ),
        });
      },
      async onError(msg) {
        if (rafId != null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (pending) {
          acc += pending;
          pending = "";
        }
        const errText = acc ? `${acc}\n\n⚠️ ${msg}` : `⚠️ ${msg}`;
        await db.updateMessageContent(assistantMsg.id, errText);
        void get().ensureNodeLabel(assistantMsg.id);
        set({
          streamingMessageId: null,
          activeStream: null,
          messages: get().messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: errText } : m
          ),
        });
      },
    });
    set({ activeStream: handle });
  },

  async cancelMainStream() {
    const { activeStream } = get();
    if (activeStream) {
      await activeStream.cancel();
    }
  },

  openSidePanel(anchorMessageId, branchRootId) {
    const { sidePanel, messages } = get();
    if (sidePanel && sidePanel.activeStream) {
      sidePanel.activeStream.cancel().catch(() => {});
    }
    let rootId: string | null = branchRootId ?? null;
    let currentNodeId: string | null = null;
    let includeInMain = false;
    if (rootId) {
      const descendants = collectBranchDescendants(messages, rootId);
      const last = descendants.length > 0 ? descendants[descendants.length - 1] : null;
      currentNodeId = last?.id ?? rootId;
      const root = messages.find((m) => m.id === rootId);
      includeInMain = root ? root.include_in_main === 1 : false;
    }
    set({
      sidePanel: {
        anchorId: anchorMessageId,
        branchRootId: rootId,
        currentNodeId,
        streamingMessageId: null,
        activeStream: null,
        includeInMain,
      },
    });
  },

  async closeSidePanel() {
    const { sidePanel } = get();
    if (sidePanel?.activeStream) {
      try {
        await sidePanel.activeStream.cancel();
      } catch {
        // ignore
      }
    }
    set({ sidePanel: null });
  },

  async sendSideMessage(text) {
    const { currentId, settings, messages, sidePanel } = get();
    if (!sidePanel || !currentId) return;

    const isFirst = sidePanel.branchRootId === null;
    const parentId = isFirst ? sidePanel.anchorId : sidePanel.currentNodeId ?? sidePanel.anchorId;

    const userMsg = await db.insertMessage({
      id: nanoid(),
      conversation_id: currentId,
      parent_id: parentId,
      role: "user",
      content: text,
      is_branch_root: isFirst,
      branch_label: isFirst ? text.trim().slice(0, 24) || "副问答" : null,
      include_in_main: sidePanel.includeInMain,
    });
    const assistantMsg = await db.insertMessage({
      id: nanoid(),
      conversation_id: currentId,
      parent_id: userMsg.id,
      role: "assistant",
      content: "",
      include_in_main: sidePanel.includeInMain,
    });

    const nextMessages = [...messages, userMsg, assistantMsg];
    set({
      messages: nextMessages,
      sidePanel: {
        ...sidePanel,
        branchRootId: sidePanel.branchRootId ?? userMsg.id,
        currentNodeId: assistantMsg.id,
        streamingMessageId: assistantMsg.id,
      },
    });
    void get().ensureNodeLabel(userMsg.id);

    if (isFirst) {
      void (async () => {
        const label = await summarizeBranchTitle(settings, text);
        if (!label) return;
        await db.updateMessageBranchLabel(userMsg.id, label);
        set({
          messages: get().messages.map((m) =>
            m.id === userMsg.id ? { ...m, branch_label: label } : m
          ),
        });
      })();
    }

    const rootIdForContext = sidePanel.branchRootId ?? userMsg.id;
    const history: ChatMessage[] = buildSideContext(
      nextMessages,
      sidePanel.anchorId,
      rootIdForContext,
      userMsg.id,
      buildSystem(settings)
    );

    let acc = "";
    let pending = "";
    let rafId: number | null = null;
    const flush = () => {
      rafId = null;
      if (!pending) return;
      acc += pending;
      pending = "";
      const text = acc;
      set({
        messages: get().messages.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: text } : m
        ),
      });
    };
    const handle = streamChat({
      provider: settings.provider,
      base_url: settings.base_url,
      model: settings.model,
      messages: history,
      temperature: settings.temperature,
      onDelta(piece) {
        pending += piece;
        if (rafId == null) {
          rafId = requestAnimationFrame(flush);
        }
      },
      async onDone() {
        if (rafId != null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (pending) {
          acc += pending;
          pending = "";
        }
        const finalText = acc;
        await db.updateMessageContent(assistantMsg.id, finalText);
        void get().ensureNodeLabel(assistantMsg.id);
        const sp = get().sidePanel;
        set({
          messages: get().messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: finalText } : m
          ),
          sidePanel: sp
            ? { ...sp, streamingMessageId: null, activeStream: null, currentNodeId: assistantMsg.id }
            : null,
        });
      },
      async onError(msg) {
        if (rafId != null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (pending) {
          acc += pending;
          pending = "";
        }
        const errText = acc ? `${acc}\n\n⚠️ ${msg}` : `⚠️ ${msg}`;
        await db.updateMessageContent(assistantMsg.id, errText);
        void get().ensureNodeLabel(assistantMsg.id);
        const sp = get().sidePanel;
        set({
          messages: get().messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: errText } : m
          ),
          sidePanel: sp ? { ...sp, streamingMessageId: null, activeStream: null } : null,
        });
      },
    });
    const sp2 = get().sidePanel;
    if (sp2) {
      set({ sidePanel: { ...sp2, activeStream: handle } });
    }
  },

  async cancelSideStream() {
    const sp = get().sidePanel;
    if (sp?.activeStream) {
      await sp.activeStream.cancel();
    }
  },

  async setSideIncludeInMain(value) {
    const { sidePanel, messages } = get();
    if (!sidePanel || !sidePanel.branchRootId) {
      if (sidePanel) {
        set({ sidePanel: { ...sidePanel, includeInMain: value } });
      }
      return;
    }
    const root = messages.find((m) => m.id === sidePanel.branchRootId);
    if (!root) return;
    const chain = collectBranchDescendants(messages, sidePanel.branchRootId);
    const ids = [root.id, ...chain.map((m) => m.id)];
    await db.updateIncludeInMainForIds(ids, value);
    const flagged = new Set(ids);
    set({
      sidePanel: { ...sidePanel, includeInMain: value },
      messages: messages.map((m) =>
        flagged.has(m.id) ? { ...m, include_in_main: value ? 1 : 0 } : m
      ),
    });
  },

  toggleMinimap() {
    set({ minimapOpen: !get().minimapOpen });
  },

  setMinimapOpen(open) {
    set({ minimapOpen: open });
  },

  async toggleHighlight(id) {
    const { messages } = get();
    const target = messages.find((m) => m.id === id);
    if (!target || target.role !== "assistant") return;
    const next = target.highlighted === 1 ? 0 : 1;
    await db.updateMessageHighlight(id, next === 1);
    set({
      messages: messages.map((m) =>
        m.id === id ? { ...m, highlighted: next } : m
      ),
    });
    if (next === 1) {
      void get().ensureNodeLabel(id);
    }
  },

  async ensureNodeLabel(id) {
    const { nodeLabels, nodeLabelLoading, messages, settings, streamingMessageId, sidePanel } = get();
    if (nodeLabels[id] || nodeLabelLoading[id]) return;
    const msg = messages.find((m) => m.id === id);
    if (!msg || msg.role === "system") return;
    if (id === streamingMessageId || id === sidePanel?.streamingMessageId) return;
    const raw = msg.content.trim();
    if (!raw) return;
    set({
      nodeLabelLoading: {
        ...nodeLabelLoading,
        [id]: true,
      },
    });
    try {
      const ai = await summarizeNodeTitle(settings, raw, msg.role);
      const title = ai ?? raw.slice(0, 22);
      await db.updateMessageNodeLabel(id, title);
      set({
        messages: get().messages.map((m) =>
          m.id === id ? { ...m, node_label: title } : m
        ),
        nodeLabels: {
          ...get().nodeLabels,
          [id]: title,
        },
      });
    } finally {
      const latestLoading = { ...get().nodeLabelLoading };
      delete latestLoading[id];
      set({ nodeLabelLoading: latestLoading });
    }
  },
}));
