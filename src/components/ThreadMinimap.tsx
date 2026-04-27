import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useAppStore } from "../store/useAppStore";
import {
  getChainToNode,
  getLatestMainLeaf,
  getLatestMessage,
} from "../lib/tree";

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeHighlight];
const HOVER_PREVIEW_DELAY_MS = 180;
const HOVER_PREVIEW_CLOSE_DELAY_MS = 120;
const HOVER_PREVIEW_WIDTH = 320;

function scrollToMessage(id: string) {
  const el = document.getElementById(`msg-${id}`);
  if (!el) return;
  const scroller = document.querySelector(".chat-scroll") as HTMLElement | null;
  if (!scroller) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const topOffset = 14;
  const scrollerRect = scroller.getBoundingClientRect();
  const targetRect = el.getBoundingClientRect();
  const targetTop = scroller.scrollTop + (targetRect.top - scrollerRect.top) - topOffset;
  scroller.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
}

function ThreadMinimap() {
  const messages = useAppStore((s) => s.messages);
  const sidePanel = useAppStore((s) => s.sidePanel);
  const minimapOpen = useAppStore((s) => s.minimapOpen);
  const setMinimapOpen = useAppStore((s) => s.setMinimapOpen);
  const mainStreamingId = useAppStore((s) => s.streamingMessageId);
  const nodeLabels = useAppStore((s) => s.nodeLabels);
  const ensureNodeLabel = useAppStore((s) => s.ensureNodeLabel);
  const [hoverPreviewId, setHoverPreviewId] = useState<string | null>(null);
  const [hoverPreviewPos, setHoverPreviewPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const shellRef = useRef<HTMLDivElement>(null);
  const hoverOpenTimerRef = useRef<number | null>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!minimapOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMinimapOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [minimapOpen, setMinimapOpen]);

  useEffect(() => {
    if (!minimapOpen) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target;
      if (isPointerInsideHoverSurface(target)) return;
      if (target instanceof Element && target.closest(".btn-minimap-toggle")) return;
      closeHoverPreviewNow();
      setMinimapOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [minimapOpen, setMinimapOpen]);

  const latest = minimapOpen
    ? getLatestMainLeaf(messages) ?? getLatestMessage(messages)
    : null;
  const mainChain = useMemo(
    () => (minimapOpen ? getChainToNode(messages, latest?.id ?? null) : []),
    [minimapOpen, messages, latest?.id]
  );

  const aiItems = useMemo(
    () => mainChain.filter((m) => m.role === "assistant"),
    [mainChain]
  );

  useEffect(() => {
    if (!minimapOpen) return;
    for (const msg of aiItems) {
      if (!msg.content.trim()) continue;
      if (msg.id === mainStreamingId) continue;
      if (msg.id === sidePanel?.streamingMessageId) continue;
      void ensureNodeLabel(msg.id);
    }
  }, [
    minimapOpen,
    aiItems,
    mainStreamingId,
    sidePanel?.streamingMessageId,
    ensureNodeLabel,
  ]);

  const highlightCount = aiItems.filter((m) => m.highlighted === 1).length;
  const hoverPreviewNode = useMemo(
    () => aiItems.find((m) => m.id === hoverPreviewId) ?? null,
    [aiItems, hoverPreviewId]
  );

  useEffect(() => {
    return () => {
      if (hoverOpenTimerRef.current != null) {
        window.clearTimeout(hoverOpenTimerRef.current);
      }
      if (hoverCloseTimerRef.current != null) {
        window.clearTimeout(hoverCloseTimerRef.current);
      }
    };
  }, []);

  function clearHoverTimers() {
    if (hoverOpenTimerRef.current != null) {
      window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    if (hoverCloseTimerRef.current != null) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }

  function closeHoverPreviewNow() {
    clearHoverTimers();
    setHoverPreviewId(null);
    setHoverPreviewPos(null);
  }

  function isPointerInsideHoverSurface(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    if (shellRef.current?.contains(target)) return true;
    return Boolean(target.closest(".timeline-hover-floating"));
  }

  function getPreviewPos(target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const viewportPadding = 8;
    const width = Math.min(HOVER_PREVIEW_WIDTH, window.innerWidth - viewportPadding * 2);
    const leftCandidate = rect.left - width - 12;
    const left = Math.max(
      viewportPadding,
      Math.min(leftCandidate, window.innerWidth - width - viewportPadding)
    );
    const topCandidate = rect.top - 8;
    const top = Math.max(
      viewportPadding,
      Math.min(topCandidate, window.innerHeight - 220)
    );
    return { top, left };
  }

  function openHoverPreviewWithDelay(id: string, target: HTMLElement) {
    clearHoverTimers();
    const pos = getPreviewPos(target);
    hoverOpenTimerRef.current = window.setTimeout(() => {
      setHoverPreviewId(id);
      setHoverPreviewPos(pos);
    }, HOVER_PREVIEW_DELAY_MS);
  }

  function scheduleCloseHoverPreview() {
    if (hoverCloseTimerRef.current != null) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
    hoverCloseTimerRef.current = window.setTimeout(() => {
      closeHoverPreviewNow();
    }, HOVER_PREVIEW_CLOSE_DELAY_MS);
  }

  useEffect(() => {
    if (!minimapOpen || !hoverPreviewId) return;
    function onPointerMove(e: PointerEvent) {
      if (!isPointerInsideHoverSurface(e.target)) {
        closeHoverPreviewNow();
      }
    }
    document.addEventListener("pointermove", onPointerMove, true);
    return () => document.removeEventListener("pointermove", onPointerMove, true);
  }, [minimapOpen, hoverPreviewId]);

  return (
    <div
      ref={shellRef}
      className={`minimap-shell ${minimapOpen ? "open" : "closed"}`}
      aria-hidden={!minimapOpen}
      onPointerLeave={scheduleCloseHoverPreview}
    >
      <div className="minimap-shell-inner">
        <aside
          className="minimap-float-pane"
          role="dialog"
          aria-label="对话记录"
        >
          <header className="minimap-pane-header">
            <h3>对话记录</h3>
            {highlightCount > 0 && (
              <span className="minimap-count">{highlightCount}</span>
            )}
          </header>
          <div className="minimap-pane-body">
            {aiItems.length === 0 ? (
              <div className="minimap-empty">当前对话还没有 AI 回答。</div>
            ) : (
              <ol className="minimap-timeline">
                {aiItems.map((node, idx) => {
                  const isHighlight = node.highlighted === 1;
                  const preview =
                    nodeLabels[node.id] || (node.content || "(空)").slice(0, 120);
                  return (
                    <li
                      key={node.id}
                      className={`timeline-item ${
                        isHighlight ? "highlight" : "default"
                      }`}
                    >
                      <button
                        className="timeline-node"
                        onClick={() => scrollToMessage(node.id)}
                        onMouseEnter={(e) => openHoverPreviewWithDelay(node.id, e.currentTarget)}
                        onMouseLeave={scheduleCloseHoverPreview}
                        aria-label={
                          isHighlight
                            ? `跳转到高光 #${idx + 1}`
                            : `跳转到 AI 回答 #${idx + 1}`
                        }
                      >
                        <span className="timeline-dot" aria-hidden="true" />
                        <span className="timeline-card">
                          <span className="timeline-preview">{preview}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </aside>
      </div>
      {hoverPreviewNode &&
        hoverPreviewPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="timeline-hover-floating"
            style={{
              top: hoverPreviewPos.top,
              left: hoverPreviewPos.left,
              width: `${Math.min(HOVER_PREVIEW_WIDTH, window.innerWidth - 16)}px`,
            }}
            onMouseEnter={clearHoverTimers}
            onMouseLeave={scheduleCloseHoverPreview}
          >
            <div
              className="timeline-hover-card-inner"
              onWheel={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.scrollTop += e.deltaY;
              }}
            >
              <ReactMarkdown
                remarkPlugins={REMARK_PLUGINS}
                rehypePlugins={REHYPE_PLUGINS}
              >
                {hoverPreviewNode.content || "(空消息)"}
              </ReactMarkdown>
            </div>
          </div>
        , document.body)}
    </div>
  );
}

export default memo(ThreadMinimap);
