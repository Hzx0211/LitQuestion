import { load, Store } from "@tauri-apps/plugin-store";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { DEFAULT_SETTINGS, type Settings } from "./types";

const STORE_FILE = "settings.json";
const KEY = "app_settings";
const WEB_SETTINGS_KEY = "litquestion_web_settings";

let storePromise: Promise<Store> | null = null;

function inTauriRuntime(): boolean {
  return isTauri() || typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: true, defaults: {} });
  }
  return storePromise;
}

export async function readSettings(): Promise<Settings> {
  if (!inTauriRuntime()) {
    try {
      const raw = localStorage.getItem(WEB_SETTINGS_KEY);
      if (!raw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  const s = await getStore();
  const v = await s.get<Partial<Settings>>(KEY);
  return { ...DEFAULT_SETTINGS, ...(v ?? {}) };
}

export async function writeSettings(settings: Settings): Promise<void> {
  if (!inTauriRuntime()) {
    localStorage.setItem(WEB_SETTINGS_KEY, JSON.stringify(settings));
    return;
  }
  const s = await getStore();
  await s.set(KEY, settings);
  await s.save();
}

export async function hasApiKey(provider: string): Promise<boolean> {
  if (!inTauriRuntime()) return false;
  return invoke<boolean>("secret_has", { provider });
}

export async function setApiKey(provider: string, value: string): Promise<void> {
  if (!inTauriRuntime()) {
    throw new Error("当前是浏览器模式，无法写入 macOS Keychain。请使用 `npm run tauri:dev` 启动应用。");
  }
  await invoke("secret_set", { provider, value });
}

export async function deleteApiKey(provider: string): Promise<void> {
  if (!inTauriRuntime()) return;
  await invoke("secret_delete", { provider });
}
