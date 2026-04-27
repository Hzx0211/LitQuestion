export type Role = "system" | "user" | "assistant";

export interface Conversation {
  id: string;
  title: string;
  model: string | null;
  provider: string | null;
  base_url: string | null;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  parent_id: string | null;
  role: Role;
  content: string;
  is_branch_root: number;
  branch_label: string | null;
  node_label: string | null;
  include_in_main: number;
  highlighted: number;
  created_at: number;
}

export interface Settings {
  provider: string;
  base_url: string;
  model: string;
  temperature: number;
  system_prompt: string;
  ui_font_size: number;
  user_name: string;
  user_avatar: string;
  enabled_models: Record<string, string[]>;
  provider_models: Record<string, StoredModelOption[]>;
}

export interface StoredModelOption {
  id: string;
  label: string;
  description: string;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: "openai",
  base_url: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  temperature: 0.7,
  system_prompt: "",
  ui_font_size: 16,
  user_name: "本地用户",
  user_avatar: "",
  enabled_models: {},
  provider_models: {},
};
