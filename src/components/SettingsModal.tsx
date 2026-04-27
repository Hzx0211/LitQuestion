import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  hasApiKey,
  listProviderModels,
  setApiKey,
  deleteApiKey,
  writeSettings,
} from "../lib/settings";
import type { Settings } from "../lib/types";
import { fileToAvatarDataURL, avatarInitials } from "../lib/avatar";
import {
  PROVIDER_PRESETS,
  getAllModelOptions,
  getProviderKey,
} from "../lib/modelPresets";

interface Props {
  open: boolean;
  onClose: () => void;
}

type TabId = "account" | "api" | "ui" | "about";

const TAB_META: { id: TabId; label: string; icon: string }[] = [
  { id: "account", label: "账户", icon: "👤" },
  { id: "api", label: "API 设置", icon: "🔑" },
  { id: "ui", label: "页面 UI", icon: "🎨" },
  { id: "about", label: "关于", icon: "ℹ" },
];

const TAB_TITLES: Record<TabId, string> = {
  account: "账户",
  api: "API 设置",
  ui: "页面 UI",
  about: "关于 LitQuestion",
};

export default function SettingsModal({ open, onClose }: Props) {
  const settings = useAppStore((s) => s.settings);
  const refreshSettings = useAppStore((s) => s.refreshSettings);
  const [form, setForm] = useState<Settings>(settings);
  const [tab, setTab] = useState<TabId>("account");
  const [apiKey, setApiKeyInput] = useState("");
  const [keyExists, setKeyExists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modelSyncing, setModelSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const dataUrl = await fileToAvatarDataURL(f);
      setForm((prev) => ({ ...prev, user_avatar: dataUrl }));
    } catch (err) {
      setMsg("头像读取失败：" + (err instanceof Error ? err.message : String(err)));
    }
  }

  useEffect(() => {
    if (open) {
      setForm(settings);
      setTab("account");
      setApiKeyInput("");
      setMsg(null);
      hasApiKey(settings.provider).then(setKeyExists);
    }
  }, [open, settings]);

  if (!open) return null;

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await writeSettings(form);
      if (apiKey.trim()) {
        await setApiKey(form.provider, apiKey.trim());
      }
      await refreshSettings();
      setMsg("已保存");
      setTimeout(() => {
        setMsg(null);
        onClose();
      }, 600);
    } catch (e) {
      setMsg("保存失败: " + String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeKey() {
    await deleteApiKey(form.provider);
    setKeyExists(false);
    await refreshSettings();
    setMsg("已删除 API Key");
  }

  const apiModelOptions = getAllModelOptions(form);
  const apiProviderKey = getProviderKey(form.provider, form.base_url);
  const configuredModelIds = form.enabled_models?.[apiProviderKey];
  const enabledModelIds =
    configuredModelIds && configuredModelIds.length > 0
      ? configuredModelIds
      : apiModelOptions.map((m) => m.id);
  const enabledModelSet = new Set(enabledModelIds);
  const allModelIds = apiModelOptions.map((m) => m.id);
  const allModelsSelected =
    allModelIds.length > 0 && allModelIds.every((id) => enabledModelSet.has(id));

  function setEnabledModelIds(nextIds: string[]) {
    if (nextIds.length === 0) return;
    const nextEnabledModels = {
      ...(form.enabled_models ?? {}),
      [apiProviderKey]: nextIds,
    };
    setForm({
      ...form,
      model: nextIds.includes(form.model) ? form.model : nextIds[0],
      enabled_models: nextEnabledModels,
    });
  }

  function toggleEnabledModel(id: string) {
    const nextIds = enabledModelSet.has(id)
      ? enabledModelIds.filter((modelId) => modelId !== id)
      : [...enabledModelIds, id];
    setEnabledModelIds(nextIds);
  }

  function toggleAllModels() {
    if (allModelIds.length === 0) return;
    if (!allModelsSelected) {
      setEnabledModelIds(allModelIds);
      return;
    }
    const fallback = allModelIds.includes(form.model) ? form.model : allModelIds[0];
    setEnabledModelIds([fallback]);
  }

  function setManualModel(model: string) {
    const nextModel = model.trim();
    if (!nextModel) {
      setForm({ ...form, model });
      return;
    }
    const nextIds = enabledModelSet.has(nextModel)
      ? enabledModelIds
      : [nextModel, ...enabledModelIds];
    setForm({
      ...form,
      model,
      enabled_models: {
        ...(form.enabled_models ?? {}),
        [apiProviderKey]: nextIds,
      },
    });
  }

  async function syncModelList() {
    setModelSyncing(true);
    setMsg(null);
    try {
      const models = await listProviderModels(
        form.provider,
        form.base_url,
        apiKey.trim() || undefined
      );
      if (models.length === 0) {
        setMsg("没有从当前 API 返回可用模型，请检查 Base URL 或模型列表权限。");
        return;
      }
      const nextProviderModels = {
        ...(form.provider_models ?? {}),
        [apiProviderKey]: models,
      };
      const nextModelOptions = getAllModelOptions({
        ...form,
        provider_models: nextProviderModels,
      });
      const nextIds = nextModelOptions.map((m) => m.id);
      setForm({
        ...form,
        model: nextIds.includes(form.model) ? form.model : nextIds[0],
        provider_models: nextProviderModels,
        enabled_models: {
          ...(form.enabled_models ?? {}),
          [apiProviderKey]: nextIds,
        },
      });
      setMsg(`已同步 ${models.length} 个模型，保存后会用于主输入框模型选择。`);
    } catch (e) {
      setMsg("同步模型失败: " + String(e));
    } finally {
      setModelSyncing(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <aside className="settings-rail">
          <button
            className="settings-rail-close"
            onClick={onClose}
            title="关闭"
            aria-label="关闭设置"
          >
            ×
          </button>
          <nav className="settings-nav" aria-label="设置分类">
            {TAB_META.map((t) => (
              <button
                key={t.id}
                className={`settings-nav-item ${tab === t.id ? "active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <span className="settings-nav-icon" aria-hidden="true">
                  {t.icon}
                </span>
                <span className="settings-nav-label">{t.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="settings-content">
          <header className="settings-content-header">
            <h2>{TAB_TITLES[tab]}</h2>
          </header>

          <div className="settings-content-body">
            {tab === "account" && (
              <>
                <div className="settings-card settings-account-card">
                  <div
                    className={`settings-account-avatar ${
                      form.user_avatar ? "has-image" : ""
                    }`}
                  >
                    {form.user_avatar ? (
                      <img src={form.user_avatar} alt="" />
                    ) : (
                      avatarInitials(form.user_name || "本地用户")
                    )}
                  </div>
                  <div className="settings-account-meta">
                    <div className="settings-account-name">
                      {form.user_name.trim() || "本地用户"}
                    </div>
                    <div className="settings-account-sub">
                      上传一张图片作为头像，并自定义你的显示名。数据只保存在本地。
                    </div>
                    <div className="settings-account-actions">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={onAvatarFile}
                      />
                      <button
                        className="btn-ghost"
                        onClick={() => fileRef.current?.click()}
                      >
                        上传头像
                      </button>
                      {form.user_avatar && (
                        <button
                          className="btn-link-danger"
                          onClick={() =>
                            setForm((prev) => ({ ...prev, user_avatar: "" }))
                          }
                        >
                          移除头像
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <label className="field">
                  <span>显示名</span>
                  <input
                    value={form.user_name}
                    placeholder="本地用户"
                    maxLength={24}
                    onChange={(e) =>
                      setForm({ ...form, user_name: e.target.value })
                    }
                  />
                  <small className="hint">
                    头像和名称仅保存在本机，不会同步到任何服务。
                  </small>
                </label>
              </>
            )}

            {tab === "api" && (
              <>
                <label className="field">
                  <span>预设</span>
                  <select
                    value={PROVIDER_PRESETS.find((p) => p.id === form.provider)?.id ?? "custom"}
                    onChange={(e) => {
                      const p = PROVIDER_PRESETS.find((x) => x.id === e.target.value);
                      if (!p) return;
                      setForm({
                        ...form,
                        provider: p.id,
                        base_url: p.base_url || form.base_url,
                        model: p.model || form.model,
                      });
                      hasApiKey(p.id).then(setKeyExists);
                    }}
                  >
                    {PROVIDER_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Provider ID（用于存储 Key 命名空间）</span>
                  <input
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span>Base URL</span>
                  <input
                    value={form.base_url}
                    placeholder="https://api.openai.com/v1"
                    onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span>模型</span>
                  <input
                    value={form.model}
                    placeholder="可手动输入模型 ID"
                    onChange={(e) => setManualModel(e.target.value)}
                  />
                  <div className="settings-model-picker">
                    <div className="settings-model-picker-head">
                      <div className="settings-model-picker-title-row">
                        <span>可选择模型</span>
                        <small>
                          {enabledModelIds.length}/{apiModelOptions.length}
                        </small>
                        <button
                          type="button"
                          className={`settings-model-sync ${modelSyncing ? "syncing" : ""}`}
                          onClick={syncModelList}
                          disabled={modelSyncing || !form.provider.trim() || !form.base_url.trim()}
                          title="同步模型列表"
                          aria-label="同步模型列表"
                        >
                          ↻
                        </button>
                      </div>
                      <div className="settings-model-picker-actions">
                        <label className="settings-model-select-all">
                          <input
                            type="checkbox"
                            checked={allModelsSelected}
                            disabled={apiModelOptions.length === 0}
                            onChange={toggleAllModels}
                          />
                          <span>全选</span>
                        </label>
                      </div>
                    </div>
                    {apiModelOptions.length === 0 ? (
                      <div className="settings-model-empty">
                        自定义供应商暂无预设模型。请在上方手动输入模型 ID。
                      </div>
                    ) : (
                      <div className="settings-model-list">
                        {apiModelOptions.map((option) => {
                          const checked = enabledModelSet.has(option.id);
                          return (
                            <label className="settings-model-option" key={option.id}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={checked && enabledModelIds.length === 1}
                                onChange={() => toggleEnabledModel(option.id)}
                              />
                              <span className="settings-model-option-main">
                                <span className="settings-model-option-name">
                                  {option.label}
                                </span>
                                <span className="settings-model-option-id">
                                  {option.id}
                                </span>
                                <span className="settings-model-option-desc">
                                  {option.description}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <small className="hint">
                    勾选后的模型会出现在主输入框的模型选择面板中。同步会使用已保存的 Key；如果上方刚填了新 Key，会临时用它拉取列表。
                  </small>
                </label>

                <label className="field">
                  <span>Temperature</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={form.temperature}
                    onChange={(e) =>
                      setForm({ ...form, temperature: parseFloat(e.target.value) || 0 })
                    }
                  />
                </label>

                <label className="field">
                  <span>System Prompt（可选）</span>
                  <textarea
                    rows={3}
                    value={form.system_prompt}
                    onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                  />
                </label>

                <label className="field">
                  <span>
                    API Key {keyExists && <em className="pill">已保存到 macOS Keychain</em>}
                  </span>
                  <div className="row">
                    <input
                      type="password"
                      value={apiKey}
                      placeholder={keyExists ? "留空则保留原有 Key" : "sk-..."}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                    />
                    {keyExists && (
                      <button className="btn-danger-outline" onClick={removeKey}>
                        删除 Key
                      </button>
                    )}
                  </div>
                  <small className="hint">
                    Key 通过系统 Keychain 加密存储，不保存在本项目文件中。
                  </small>
                </label>
              </>
            )}

            {tab === "ui" && (
              <label className="field">
                <span>字号（全局）</span>
                <div className="row settings-font-row">
                  <input
                    type="range"
                    min={13}
                    max={20}
                    step={1}
                    value={form.ui_font_size}
                    onChange={(e) =>
                      setForm({ ...form, ui_font_size: parseInt(e.target.value, 10) || 16 })
                    }
                  />
                  <input
                    type="number"
                    min={13}
                    max={20}
                    value={form.ui_font_size}
                    onChange={(e) =>
                      setForm({ ...form, ui_font_size: parseInt(e.target.value, 10) || 16 })
                    }
                  />
                </div>
                <small className="hint">调整 LitQuestion 全局字号，默认 16。</small>
              </label>
            )}

            {tab === "about" && (
              <div className="settings-card settings-about-card">
                <div className="settings-about-title">LitQuestion</div>
                <div className="settings-about-sub">
                  一款面向深度阅读与追问的本地对话工具。
                </div>
                <div className="settings-about-meta">
                  <div>版本：0.1.0</div>
                  <div>运行：Tauri + React</div>
                </div>
              </div>
            )}
          </div>

          {tab !== "about" && (
            <footer className="settings-content-footer">
              {msg && <span className="modal-msg">{msg}</span>}
              <button className="btn-ghost" onClick={onClose}>
                取消
              </button>
              <button className="btn-primary" disabled={saving} onClick={save}>
                {saving ? "保存中…" : "保存"}
              </button>
            </footer>
          )}
        </section>
      </div>
    </div>
  );
}
