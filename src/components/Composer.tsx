import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";

export default function Composer() {
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const hasKey = useAppStore((s) => s.hasKey);
  const streaming = useAppStore((s) => s.streamingMessageId !== null);
  const sendMainMessage = useAppStore((s) => s.sendMainMessage);
  const cancelMainStream = useAppStore((s) => s.cancelMainStream);
  const minimapOpen = useAppStore((s) => s.minimapOpen);
  const toggleMinimap = useAppStore((s) => s.toggleMinimap);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!streaming) ref.current?.focus();
  }, [streaming]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [text]);

  const canSend = text.trim().length > 0 && !streaming && hasKey;

  async function doSend() {
    if (!canSend) return;
    const v = text;
    setText("");
    setSendError(null);
    try {
      await sendMainMessage(v);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("sendMainMessage failed", e);
      setSendError(msg);
      setText(v);
    }
  }

  return (
    <div className="composer">
      {!hasKey && (
        <div className="composer-warning">尚未配置 API Key，请先在右下角 ⚙ 设置中填入。</div>
      )}
      {sendError && (
        <div className="composer-warning">发送失败：{sendError}</div>
      )}
      <div className="composer-dock">
        <div className="composer-box">
          <textarea
            ref={ref}
            rows={1}
            value={text}
            placeholder={hasKey ? "有问题，尽管问" : "先在设置里配置 API"}
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
            <button className="btn-stop" onClick={() => cancelMainStream()} title="停止生成">
              ■
            </button>
          ) : (
            <button
              className="btn-send"
              onClick={doSend}
              disabled={!canSend}
              title="发送 (Enter)"
            >
              ↑
            </button>
          )}
        </div>
        <button
          className={`btn-minimap-toggle ${minimapOpen ? "open" : "closed"}`}
          onClick={toggleMinimap}
          title={minimapOpen ? "收起对话记录" : "展开对话记录"}
          aria-label={minimapOpen ? "收起对话记录" : "展开对话记录"}
          aria-expanded={minimapOpen}
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
            aria-hidden="true"
          >
            <polyline points="4 6 8 10 12 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
