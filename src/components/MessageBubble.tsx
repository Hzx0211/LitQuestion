import { memo, useMemo, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "../lib/types";

interface Props {
  message: Message;
  streaming?: boolean;
  footer?: ReactNode;
  canDrag?: boolean;
  beingDragged?: boolean;
  highlighted?: boolean;
  onHandleMouseDown?: (e: ReactMouseEvent<HTMLDivElement>) => void;
}

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeHighlight];

function MessageBubbleInner({
  message,
  streaming,
  footer,
  canDrag,
  beingDragged,
  highlighted,
  onHandleMouseDown,
}: Props) {
  const isUser = message.role === "user";
  const content = message.content;

  const rendered = useMemo(() => {
    if (content.length === 0) return null;
    return (
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
        {content}
      </ReactMarkdown>
    );
  }, [content]);

  const bubbleClassName = [
    "msg-bubble-block",
    canDrag ? "has-drag-handle" : "",
    beingDragged ? "being-dragged" : "",
    highlighted ? "highlighted" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`msg-row ${isUser ? "user" : "assistant"}`}>
      <div className="msg-avatar">{isUser ? "你" : "AI"}</div>
      <div className="msg-body">
        <div className={bubbleClassName}>
          {content.length === 0 && streaming ? (
            <div className="msg-thinking">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <div className="msg-content">
              {rendered}
              {streaming && <span className="cursor-blink" />}
              {canDrag && (
                <div
                  className={`msg-drag-handle ${highlighted ? "active" : ""}`}
                  onMouseDown={onHandleMouseDown}
                  title={
                    highlighted
                      ? "已标记为高光（点击取消 / 拖拽到右侧追问）"
                      : "点击标记高光 / 拖拽到右侧追问"
                  }
                  aria-label="标记高光或拖拽追问"
                  aria-pressed={highlighted ? true : false}
                  role="button"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    fill={highlighted ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 2.2 l2.42 4.9 5.41.79 -3.91 3.81 .92 5.39 L10 14.55 5.16 17.09l.92-5.39L2.17 7.89l5.41-.79L10 2.2z" />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>
        {footer && (
          <div className="msg-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubbleInner);
