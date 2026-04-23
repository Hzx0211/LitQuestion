import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import MessageBubble from "./MessageBubble";
import { collectBranchDescendants } from "../lib/tree";

const STICK_THRESHOLD_PX = 80;

interface SidePanelProps {
  width: number;
}

export default function SidePanel({ width }: SidePanelProps) {
  const sidePanel = useAppStore((s) => s.sidePanel);
  const messages = useAppStore((s) => s.messages);
  const hasKey = useAppStore((s) => s.hasKey);
  const sendSideMessage = useAppStore((s) => s.sendSideMessage);
  const cancelSideStream = useAppStore((s) => s.cancelSideStream);
  const setSideIncludeInMain = useAppStore((s) => s.setSideIncludeInMain);

  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const anchor = useMemo(
    () => (sidePanel ? messages.find((m) => m.id === sidePanel.anchorId) ?? null : null),
    [messages, sidePanel]
  );

  const sideMessages = useMemo(() => {
    if (!sidePanel?.branchRootId) return [] as typeof messages;
    const root = messages.find((m) => m.id === sidePanel.branchRootId);
    if (!root) return [];
    const rest = collectBranchDescendants(messages, root.id);
    return [root, ...rest];
  }, [messages, sidePanel?.branchRootId]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [text]);

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
  }, [sideMessages, sidePanel?.streamingMessageId]);

  useEffect(() => {
    stickToBottomRef.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sidePanel?.branchRootId, sidePanel?.anchorId]);

  if (!sidePanel) return null;

  const streaming = sidePanel.streamingMessageId !== null;
  const canSend = text.trim().length > 0 && !streaming && hasKey;

  async function doSend() {
    if (!canSend) return;
    const v = text;
    setText("");
    await sendSideMessage(v);
  }

  return (
    <aside className="side-panel" style={{ width }}>
      <header className="side-header">
        <div className="side-anchor">
          <div className="side-anchor-label">副窗口追问</div>
          <div className="side-anchor-preview" title={anchor?.content || ""}>
            锚点：{(anchor?.content || "(空)").slice(0, 80)}
          </div>
        </div>
        <label className="side-toggle" title="开启后，本副问答整链将并入主请求上下文">
          <input
            type="checkbox"
            checked={sidePanel.includeInMain}
            onChange={(e) => setSideIncludeInMain(e.target.checked)}
          />
          <span>加入主上下文</span>
        </label>
      </header>

      <div className="side-scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="side-inner">
          {sideMessages.length === 0 ? (
            <div className="side-empty">
              在锚点消息下尚未有副问答。输入你的问题开启这条副链。
            </div>
          ) : (
            sideMessages.map((m) => (
              <div key={m.id} id={`side-msg-${m.id}`}>
                <MessageBubble
                  message={m}
                  streaming={m.id === sidePanel.streamingMessageId}
                  highlighted={m.highlighted === 1}
                />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="composer side-composer">
        {!hasKey && (
          <div className="composer-warning">尚未配置 API Key。</div>
        )}
        <div className="composer-box">
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            placeholder={hasKey ? "问个小问题" : "先在设置里配置 API"}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                doSend();
              }
            }}
            disabled={!hasKey}
          />
          {streaming ? (
            <button className="btn-stop" onClick={() => cancelSideStream()} title="停止">
              ■
            </button>
          ) : (
            <button className="btn-send" onClick={doSend} disabled={!canSend} title="发送">
              ↑
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
