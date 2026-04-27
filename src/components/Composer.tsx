import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  formatAttachmentSize,
  prepareAttachmentFiles,
  type PreparedAttachment,
} from "../lib/attachments";
import { getModelOptions } from "../lib/modelPresets";

export default function Composer() {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachmentNotice, setAttachmentNotice] = useState<string | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const hasKey = useAppStore((s) => s.hasKey);
  const settings = useAppStore((s) => s.settings);
  const streaming = useAppStore((s) => s.streamingMessageId !== null);
  const sendMainMessage = useAppStore((s) => s.sendMainMessage);
  const cancelMainStream = useAppStore((s) => s.cancelMainStream);
  const setModel = useAppStore((s) => s.setModel);
  const minimapOpen = useAppStore((s) => s.minimapOpen);
  const toggleMinimap = useAppStore((s) => s.toggleMinimap);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const [modelPickerLeft, setModelPickerLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!streaming) ref.current?.focus();
  }, [streaming]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [text]);

  useEffect(() => {
    if (!modelPickerOpen) return;
    function syncModelPickerPosition() {
      const rect = modelButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const panelWidth = Math.min(300, window.innerWidth - 52);
      const nextLeft = Math.max(
        26,
        Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 26)
      );
      setModelPickerLeft(nextLeft);
    }
    function onPointerDown(e: PointerEvent) {
      if (!modelPickerRef.current?.contains(e.target as Node)) {
        setModelPickerOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setModelPickerOpen(false);
    }
    syncModelPickerPosition();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", syncModelPickerPosition);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", syncModelPickerPosition);
    };
  }, [modelPickerOpen]);

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !streaming && hasKey;
  const modelOptions = getModelOptions(settings);

  async function handleFileChange(files: FileList | null) {
    if (!files || files.length === 0) return;
    const result = await prepareAttachmentFiles(Array.from(files));
    if (result.attachments.length > 0) {
      setAttachments((prev) => [...prev, ...result.attachments]);
    }
    if (result.errors.length > 0) {
      setAttachmentNotice(result.errors.join(" "));
    } else {
      setAttachmentNotice(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function doSend() {
    if (!canSend) return;
    const v = text;
    const pendingAttachments = attachments;
    setText("");
    setAttachments([]);
    setSendError(null);
    setAttachmentNotice(null);
    try {
      await sendMainMessage(v, pendingAttachments);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("sendMainMessage failed", e);
      setSendError(msg);
      setText(v);
      setAttachments(pendingAttachments);
    }
  }

  async function chooseModel(model: string) {
    await setModel(model);
    setModelPickerOpen(false);
    ref.current?.focus();
  }

  return (
    <div className="composer">
      {!hasKey && (
        <div className="composer-warning">尚未配置 API Key，请先在右下角 ⚙ 设置中填入。</div>
      )}
      {sendError && (
        <div className="composer-warning">发送失败：{sendError}</div>
      )}
      {attachmentNotice && (
        <div className="composer-warning">附件提示：{attachmentNotice}</div>
      )}
      <div className="composer-dock">
        <button
          className="btn-attachment-toggle"
          onClick={() => fileInputRef.current?.click()}
          title="添加文档或图片"
          aria-label="添加文档或图片"
          disabled={!hasKey || streaming}
        >
        </button>
        <input
          ref={fileInputRef}
          className="composer-file-input"
          type="file"
          multiple
          accept="image/*,.pdf,application/pdf,.txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.xml,.html,.htm,.log,.rtf,.yaml,.yml,.toml,.ini,.sql,.css,.scss,.sass,.less,.js,.jsx,.ts,.tsx,.py,.java,.c,.cc,.cpp,.h,.hpp,.cs,.go,.rs,.swift,.kt,.php,.rb,.sh,.zsh,.fish"
          onChange={(e) => handleFileChange(e.target.files)}
        />
        <div className="composer-box">
          <div className="composer-input-stack">
            {attachments.length > 0 && (
              <div className="attachment-tray" aria-label="已添加附件">
                {attachments.map((attachment) => (
                  <div className="attachment-chip" key={attachment.id}>
                    <span className="attachment-chip-icon">
                      {attachment.kind === "image" ? "图" : "文"}
                    </span>
                    <span className="attachment-chip-name" title={attachment.name}>
                      {attachment.name}
                    </span>
                    <span className="attachment-chip-size">
                      {formatAttachmentSize(attachment.size)}
                    </span>
                    <button
                      className="attachment-chip-remove"
                      onClick={() => removeAttachment(attachment.id)}
                      title="移除附件"
                      aria-label={`移除 ${attachment.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
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
          </div>
          <div className="model-picker" ref={modelPickerRef}>
            {modelPickerOpen && (
              <div
                className="model-picker-popover"
                style={modelPickerLeft == null ? undefined : { left: modelPickerLeft }}
                role="menu"
                aria-label="模型选择"
              >
                <div className="model-picker-title">选择模型</div>
                <div
                  className="model-option-list"
                  onWheel={(e) => {
                    e.stopPropagation();
                  }}
                >
                  {modelOptions.map((option) => {
                    const active = option.id === settings.model;
                    return (
                      <button
                        key={option.id}
                        className={`model-option ${active ? "active" : ""}`}
                        onClick={() => chooseModel(option.id)}
                        role="menuitemradio"
                        aria-checked={active}
                      >
                        <span className="model-option-main">
                          <span className="model-option-name">{option.label}</span>
                          <span className="model-option-id">{option.id}</span>
                        </span>
                        <span className="model-option-desc">{option.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <button
              ref={modelButtonRef}
              className={`btn-model-select ${modelPickerOpen ? "open" : ""}`}
              onClick={() => setModelPickerOpen((open) => !open)}
              title={`当前模型：${settings.model}`}
              aria-label={`选择模型，当前模型：${settings.model}`}
              aria-expanded={modelPickerOpen}
              disabled={streaming}
            >
              <span className="btn-model-name">{settings.model}</span>
              <span className="btn-model-chevron" aria-hidden="true">⌃</span>
            </button>
          </div>
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
