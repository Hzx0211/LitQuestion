import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useAppStore } from "../store/useAppStore";
import MessageBubble from "./MessageBubble";
import Composer from "./Composer";
import SidePanel from "./SidePanel";
import { buildChildrenMap, getChainToNode, getLatestMainLeaf, getLatestMessage } from "../lib/tree";
import type { Message } from "../lib/types";
import ThreadMinimap from "./ThreadMinimap";

const STICK_THRESHOLD_PX = 80;
const SIDE_MIN_WIDTH = 320;
const SIDE_MAX_WIDTH = 760;
const MAIN_MIN_WIDTH = 420;
const SIDE_WIDTH_KEY = "litquestion_side_width";
const DRAG_THRESHOLD_PX = 6;

type DropZone = "main" | "side";

interface DragState {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  preview: string;
  over: DropZone | null;
}

function toDragPreviewText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " [代码块] ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function ChatView() {
  const messages = useAppStore((s) => s.messages);
  const streamingId = useAppStore((s) => s.streamingMessageId);
  const currentId = useAppStore((s) => s.currentId);
  const currentNodeId = useAppStore((s) => s.currentNodeId);
  const sidePanel = useAppStore((s) => s.sidePanel);
  const openSidePanel = useAppStore((s) => s.openSidePanel);
  const toggleHighlight = useAppStore((s) => s.toggleHighlight);
  const [sideCollapsed, setSideCollapsed] = useState(false);

  const [sideWidth, setSideWidth] = useState(() => {
    if (typeof window === "undefined") return 420;
    const raw = window.localStorage.getItem(SIDE_WIDTH_KEY);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(parsed)) return 420;
    return Math.min(SIDE_MAX_WIDTH, Math.max(SIDE_MIN_WIDTH, parsed));
  });
  const [dragState, setDragState] = useState<DragState | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const splitRef = useRef<HTMLElement>(null);
  const draggingRef = useRef<{
    startX: number;
    startWidth: number;
    maxWidth: number;
  } | null>(null);

  const latestMain = getLatestMainLeaf(messages) ?? getLatestMessage(messages);
  const thread = getChainToNode(messages, currentNodeId ?? latestMain?.id ?? null);
  const childrenMap = buildChildrenMap(messages);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance <= STICK_THRESHOLD_PX;
  }

  useLayoutEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingId, currentId, currentNodeId]);

  useEffect(() => {
    stickToBottomRef.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [currentId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDE_WIDTH_KEY, String(sideWidth));
    }
  }, [sideWidth]);

  useEffect(() => {
    if (!sidePanel) {
      setSideCollapsed(false);
    }
  }, [sidePanel]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = document.activeElement as HTMLElement | null;
    if (
      active &&
      active.closest(
        "textarea, input, select, .sidebar, .settings-modal, .side-shell"
      )
    ) {
      return;
    }
    el.focus({ preventScroll: true });
  }, [sidePanel, sideCollapsed]);

  function openSidePanelAndExpand(anchorMessageId: string, branchRootId?: string | null) {
    openSidePanel(anchorMessageId, branchRootId);
    setSideCollapsed(false);
  }

  useEffect(() => {
    return () => {
      document.body.classList.remove("resizing-side");
      document.body.classList.remove("dragging-bubble");
      window.onmousemove = null;
      window.onmouseup = null;
    };
  }, []);

  useEffect(() => {
    let wasInMain = false;
    function onDocMouseMove(e: MouseEvent) {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;
      const rect = scrollEl.getBoundingClientRect();
      const inMain =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (inMain && !wasInMain) {
        const active = document.activeElement as HTMLElement | null;
        const protectedFocus =
          active &&
          active.closest(
            "textarea, input, select, .sidebar, .settings-modal"
          );
        if (!protectedFocus && active !== scrollEl) {
          scrollEl.focus({ preventScroll: true });
        }
      }
      wasInMain = inMain;
    }
    document.addEventListener("mousemove", onDocMouseMove);
    return () => document.removeEventListener("mousemove", onDocMouseMove);
  }, []);

  useEffect(() => {
    function onGlobalWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) < 0.5) return;
      const scrollEl = scrollRef.current;
      const splitEl = splitRef.current;
      if (!scrollEl || !splitEl) return;
      const splitRect = splitEl.getBoundingClientRect();
      if (
        e.clientX < splitRect.left ||
        e.clientX > splitRect.right ||
        e.clientY < splitRect.top ||
        e.clientY > splitRect.bottom
      )
        return;
      const scrollRect = scrollEl.getBoundingClientRect();
      const inMainArea =
        e.clientX >= scrollRect.left &&
        e.clientX <= scrollRect.right &&
        e.clientY >= scrollRect.top &&
        e.clientY <= scrollRect.bottom;
      if (!inMainArea) return;
      const el = document.elementFromPoint(e.clientX, e.clientY) as
        | HTMLElement
        | null;
      if (el) {
        if (el.closest(".minimap-float-pane")) return;
        if (el.closest(".timeline-hover-floating, .timeline-hover-card-inner")) return;
        if (el.closest(".settings-modal, .modal-backdrop")) return;
        if (el.closest("textarea")) return;
      }
      e.preventDefault();
      e.stopPropagation();
      scrollEl.scrollTop += e.deltaY;
    }
    document.addEventListener("wheel", onGlobalWheel, {
      passive: false,
      capture: true,
    });
    return () =>
      document.removeEventListener("wheel", onGlobalWheel, {
        capture: true,
      } as EventListenerOptions);
  }, []);

  function startResize(e: ReactMouseEvent<HTMLDivElement>) {
    if (!sidePanel) return;
    e.preventDefault();
    const total = splitRef.current?.clientWidth ?? window.innerWidth;
    const maxByLayout = Math.max(SIDE_MIN_WIDTH, total - MAIN_MIN_WIDTH);
    const maxWidth = Math.min(SIDE_MAX_WIDTH, maxByLayout);
    draggingRef.current = {
      startX: e.clientX,
      startWidth: sideWidth,
      maxWidth,
    };
    document.body.classList.add("resizing-side");
    window.onmousemove = (ev: MouseEvent) => {
      const drag = draggingRef.current;
      if (!drag) return;
      const delta = drag.startX - ev.clientX;
      const next = Math.min(drag.maxWidth, Math.max(SIDE_MIN_WIDTH, drag.startWidth + delta));
      setSideWidth(next);
    };
    window.onmouseup = () => {
      draggingRef.current = null;
      document.body.classList.remove("resizing-side");
      window.onmousemove = null;
      window.onmouseup = null;
    };
  }

  function detectZone(clientX: number, clientY: number): DropZone | null {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const zone = (el as HTMLElement).closest("[data-drop-zone]");
    if (!zone) return null;
    const v = zone.getAttribute("data-drop-zone");
    if (v === "main" || v === "side") return v;
    return null;
  }

  function handleHandleMouseDown(m: Message, e: ReactMouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if (m.id === streamingId) return;
    e.preventDefault();
    e.stopPropagation();

    const handleEl = e.currentTarget as HTMLElement;
    const bubbleEl =
      (handleEl.closest(".msg-bubble-block") as HTMLElement | null) ?? handleEl;
    const rect = bubbleEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const ghostWidth = Math.min(Math.max(rect.width, 160), 280);
    const ghostHeight = Math.min(Math.max(rect.height, 60), 140);
    const preview = toDragPreviewText(m.content).slice(0, 120);

    let started = false;
    let rafId: number | null = null;
    let latestPoint: { x: number; y: number } | null = null;

    const flushDrag = () => {
      rafId = null;
      if (!latestPoint) return;
      const over = detectZone(latestPoint.x, latestPoint.y);
      setDragState({
        id: m.id,
        x: latestPoint.x,
        y: latestPoint.y,
        width: ghostWidth,
        height: ghostHeight,
        preview,
        over,
      });
    };

    const onMove = (ev: MouseEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) {
          return;
        }
        started = true;
        document.body.classList.add("dragging-bubble");
        window.getSelection()?.removeAllRanges();
      }
      latestPoint = { x: ev.clientX, y: ev.clientY };
      if (rafId == null) {
        rafId = requestAnimationFrame(flushDrag);
      }
    };

    const onUp = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("dragging-bubble");
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (started) {
        const over = detectZone(ev.clientX, ev.clientY);
        if (over === "main" || over === "side") {
          openSidePanelAndExpand(m.id, null);
        }
      } else {
        void toggleHighlight(m.id);
      }
      setDragState(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function openLatestSidePanelForCurrentConversation() {
    const latestBranchRoot = [...messages]
      .filter((m) => m.is_branch_root === 1 && m.parent_id)
      .sort((a, b) => b.created_at - a.created_at)[0];
    if (!latestBranchRoot || !latestBranchRoot.parent_id) return;
    openSidePanelAndExpand(latestBranchRoot.parent_id, latestBranchRoot.id);
  }

  const sideExpanded = Boolean(sidePanel) && !sideCollapsed;

  return (
    <section className="chat-split" ref={splitRef}>
      <section className={`chat ${sideExpanded ? "with-side" : ""}`}>
        <div
          className="chat-scroll"
          ref={scrollRef}
          onScroll={onScroll}
          tabIndex={-1}
        >
          <div className="chat-inner">
            {!currentId && (
              <div className="welcome">
                <h1>LitQuestion</h1>
                <p>本地 GPT 客户端 · 在任意 AI 回复下可打开侧窗口做分支追问。先在设置中配置 API，或直接新建对话开始提问。</p>
              </div>
            )}
            {thread.map((m) => {
              const branchRoots = (childrenMap.get(m.id) ?? []).filter(
                (c) => c.is_branch_root === 1
              );
              const canDrag = m.role === "assistant" && m.id !== streamingId;
              return (
                <div key={m.id} id={`msg-${m.id}`}>
                  <MessageBubble
                    message={m}
                    streaming={m.id === streamingId}
                    canDrag={canDrag}
                    beingDragged={dragState?.id === m.id}
                    highlighted={m.highlighted === 1}
                    onHandleMouseDown={
                      canDrag
                        ? (e) => handleHandleMouseDown(m, e)
                        : undefined
                    }
                    footer={
                      m.role === "assistant" ? (
                        <div className="branch-row">
                          {branchRoots.length > 0 && (
                            <div className="branch-list">
                              {branchRoots.map((root, idx) => {
                                const active =
                                  sidePanel?.branchRootId === root.id;
                                return (
                                  <button
                                    key={root.id}
                                    className={`branch-chip ${active ? "active" : ""}`}
                                    title={root.content}
                                    onClick={() => openSidePanelAndExpand(m.id, root.id)}
                                  >
                                    {root.branch_label
                                      ? root.branch_label
                                      : `分支${idx + 1}：${(root.content || "(空)").slice(0, 14)}`}
                                    {root.include_in_main === 1 && (
                                      <span className="branch-chip-flag" title="已并入主上下文">·主</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : null
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>

        {dragState && (
          <div className="drag-backdrop" aria-hidden="true" />
        )}

        {dragState && !sideExpanded && (
          <div
            className={`anchor-drop-main ${dragState.over === "main" ? "active" : ""}`}
            data-drop-zone="main"
          >
            <div className="anchor-drop-card">
              <div className="anchor-drop-title">
                {dragState.over === "main"
                  ? "松开即可在侧窗口追问"
                  : "拖到此处在侧窗口追问"}
              </div>
              <div className="anchor-drop-hint">
                将以当前 AI 回答作为锚点新建分支
              </div>
            </div>
          </div>
        )}

        <ThreadMinimap />
        <Composer />
      </section>
      <section
        className={`side-shell ${sideExpanded ? "open" : "closed"}`}
        style={{ width: sideExpanded ? sideWidth + 8 : 0 }}
      >
        {sidePanel && sideExpanded && (
          <div
            className="side-resizer"
            onMouseDown={startResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="调整副窗口宽度"
          />
        )}
        <div className="side-shell-inner">
          <SidePanel width={sideWidth} />
          {dragState && sideExpanded && (
            <div className="drag-backdrop side" aria-hidden="true" />
          )}
          {dragState && sideExpanded && (
            <div
              className={`anchor-drop-side ${dragState.over === "side" ? "active" : ""}`}
              data-drop-zone="side"
            >
              <div className="anchor-drop-card">
                <div className="anchor-drop-title">
                  {dragState.over === "side"
                    ? "松开以此为锚点追问"
                    : "拖到这里进行追问"}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      {currentId && (
        <button
          className={`side-edge-handle ${sideExpanded ? "open" : "closed"}`}
          style={{
            right: sideExpanded ? sideWidth - 7 : 8,
          }}
          onClick={(e) => {
            if (sideExpanded) {
              setSideCollapsed(true);
            } else if (sidePanel) {
              setSideCollapsed(false);
            } else {
              openLatestSidePanelForCurrentConversation();
            }
            (e.currentTarget as HTMLButtonElement).blur();
          }}
          title={sideExpanded ? "收起副窗口" : "展开副窗口"}
          aria-label={sideExpanded ? "收起副窗口" : "展开副窗口"}
        >
          <span
            className={`side-edge-icon ${sideExpanded ? "open" : "closed"}`}
            aria-hidden="true"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 6 8 10 12 6" />
            </svg>
          </span>
        </button>
      )}

      {dragState && (
        <div
          className="drag-ghost"
          style={{
            left: dragState.x - dragState.width + 8,
            top: dragState.y - 8,
            width: dragState.width,
            maxHeight: dragState.height,
          }}
        >
          <div className="drag-ghost-badge">AI</div>
          <div className="drag-ghost-text">{dragState.preview || "（空白回复）"}</div>
        </div>
      )}
    </section>
  );
}
