import { useEffect, useState, type CSSProperties } from "react";
import Sidebar from "./components/Sidebar";
import ChatView from "./components/ChatView";
import SettingsModal from "./components/SettingsModal";
import { useAppStore } from "./store/useAppStore";

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const init = useAppStore((s) => s.init);
  const hasKey = useAppStore((s) => s.hasKey);
  const settings = useAppStore((s) => s.settings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    init().catch((e) => console.error("init failed", e));
  }, [init]);

  useEffect(() => {
    if (ready && !hasKey) {
      setSettingsOpen(true);
    }
  }, [ready, hasKey]);

  return (
    <div
      className="app"
      style={{ "--app-font-size": `${settings.ui_font_size}px` } as CSSProperties}
    >
      <div className="titlebar" data-tauri-drag-region />
      <div className="workspace">
        <div className={`sidebar-shell ${sidebarOpen ? "open" : "closed"}`}>
          <div className="sidebar-shell-inner">
            <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
          </div>
        </div>
        <button
          className={`sidebar-edge-handle ${sidebarOpen ? "open" : "closed"}`}
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? "收起对话栏" : "展开对话栏"}
          aria-label={sidebarOpen ? "收起对话栏" : "展开对话栏"}
        >
          <span
            className={`sidebar-edge-icon ${sidebarOpen ? "open" : "closed"}`}
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
        <ChatView />
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
