import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { avatarInitials } from "../lib/avatar";

interface SidebarProps {
  onOpenSettings: () => void;
}

export default function Sidebar({ onOpenSettings }: SidebarProps) {
  const conversations = useAppStore((s) => s.conversations);
  const currentId = useAppStore((s) => s.currentId);
  const selectConversation = useAppStore((s) => s.selectConversation);
  const newConversation = useAppStore((s) => s.newConversation);
  const renameConversation = useAppStore((s) => s.renameConversation);
  const deleteConversation = useAppStore((s) => s.deleteConversation);
  const userName = useAppStore((s) => s.settings.user_name);
  const userAvatar = useAppStore((s) => s.settings.user_avatar);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const displayName = userName.trim() || "本地用户";
  const initials = avatarInitials(displayName);

  return (
    <aside className="sidebar">
      <div className="sidebar-header" data-tauri-drag-region>
        <button className="btn-primary" onClick={() => newConversation()}>
          + 新对话
        </button>
      </div>

      <nav className="conv-list">
        {conversations.length === 0 && (
          <div className="empty-hint">暂无对话，点击"+ 新对话"开始</div>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`conv-item ${c.id === currentId ? "active" : ""}`}
            onClick={() => selectConversation(c.id)}
            onDoubleClick={() => {
              setEditingId(c.id);
              setEditingTitle(c.title);
            }}
          >
            {editingId === c.id ? (
              <input
                autoFocus
                className="conv-rename-input"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={async () => {
                  if (editingTitle.trim() && editingTitle !== c.title) {
                    await renameConversation(c.id, editingTitle.trim());
                  }
                  setEditingId(null);
                }}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  } else if (e.key === "Escape") {
                    setEditingId(null);
                  }
                }}
              />
            ) : (
              <>
                <span className="conv-title">{c.title}</span>
                <button
                  className="conv-delete"
                  title="删除"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await deleteConversation(c.id);
                  }}
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="user-profile"
          onClick={onOpenSettings}
          title="打开设置"
          aria-label="打开设置"
        >
          <div
            className={`user-avatar ${userAvatar ? "has-image" : ""}`}
            aria-hidden="true"
          >
            {userAvatar ? (
              <img src={userAvatar} alt="" />
            ) : (
              initials
            )}
          </div>
          <div className="user-info">
            <div className="user-name">{displayName}</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
