export interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export interface ProviderPreset {
  id: string;
  name: string;
  base_url: string;
  model: string;
  models: ModelOption[];
  aliases?: string[];
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    base_url: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    aliases: ["openai.com"],
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini", description: "轻量通用" },
      { id: "gpt-4o", label: "GPT-4o", description: "通用多模态" },
    ],
  },
  {
    id: "anthropic-compat",
    name: "Claude (OpenAI 兼容)",
    base_url: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-5",
    aliases: ["anthropic", "claude"],
    models: [
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", description: "OpenAI 兼容端点" },
      { id: "claude-opus-4-1", label: "Claude Opus 4.1", description: "高质量复杂任务" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", description: "低延迟轻量任务" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    base_url: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    aliases: ["deepseek"],
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat", description: "通用对话与写作" },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner", description: "复杂推理与分析" },
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", description: "更快响应" },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", description: "更强能力" },
    ],
  },
  {
    id: "kimi",
    name: "Kimi / Moonshot",
    base_url: "https://api.moonshot.cn/v1",
    model: "kimi-k2.6",
    aliases: ["kimi", "moonshot"],
    models: [
      { id: "kimi-k2.6", label: "Kimi K2.6", description: "最新旗舰，多模态与 Agent" },
      { id: "kimi-k2.5", label: "Kimi K2.5", description: "多模态长上下文" },
      { id: "moonshot-v1-128k", label: "Moonshot 128K", description: "长上下文阅读" },
      { id: "moonshot-v1-32k", label: "Moonshot 32K", description: "中长上下文" },
      { id: "moonshot-v1-8k", label: "Moonshot 8K", description: "轻量对话" },
      { id: "moonshot-v1-128k-vision-preview", label: "Moonshot Vision 128K", description: "图片理解" },
    ],
  },
  {
    id: "minimax",
    name: "MiniMax",
    base_url: "https://api.minimaxi.com/v1",
    model: "MiniMax-M2.7",
    aliases: ["minimax"],
    models: [
      { id: "MiniMax-M2.7", label: "MiniMax M2.7", description: "最新文本模型" },
      { id: "MiniMax-M2.7-highspeed", label: "MiniMax M2.7 Highspeed", description: "更快响应" },
      { id: "MiniMax-M2.5", label: "MiniMax M2.5", description: "高性价比复杂任务" },
      { id: "MiniMax-M2.5-highspeed", label: "MiniMax M2.5 Highspeed", description: "M2.5 快速版" },
      { id: "MiniMax-M2.1", label: "MiniMax M2.1", description: "编程与多语言" },
      { id: "MiniMax-M2.1-highspeed", label: "MiniMax M2.1 Highspeed", description: "M2.1 快速版" },
      { id: "MiniMax-M2", label: "MiniMax M2", description: "Agent 与推理" },
    ],
  },
  {
    id: "glm",
    name: "GLM / Z.AI",
    base_url: "https://api.z.ai/api/paas/v4",
    model: "glm-4.7",
    aliases: ["glm", "z.ai", "bigmodel", "zhipu", "智谱"],
    models: [
      { id: "glm-4.7", label: "GLM-4.7", description: "旗舰通用模型" },
      { id: "glm-4.7-flash", label: "GLM-4.7 Flash", description: "快速低成本" },
      { id: "glm-4.7-flashx", label: "GLM-4.7 FlashX", description: "高速增强" },
      { id: "glm-4.6", label: "GLM-4.6", description: "稳定通用" },
    ],
  },
  {
    id: "siliconflow",
    name: "硅基流动",
    base_url: "https://api.siliconflow.cn/v1",
    model: "deepseek-ai/DeepSeek-V3.2",
    aliases: ["siliconflow", "silicon", "硅基流动"],
    models: [
      { id: "deepseek-ai/DeepSeek-V3.2", label: "DeepSeek V3.2", description: "通用与代码" },
      { id: "deepseek-ai/DeepSeek-V3.2-Exp", label: "DeepSeek V3.2 Exp", description: "实验版" },
      { id: "deepseek-ai/DeepSeek-R1", label: "DeepSeek R1", description: "推理模型" },
      { id: "zai-org/GLM-5.1", label: "GLM-5.1", description: "Z.AI 最新模型" },
      { id: "zai-org/GLM-5", label: "GLM-5", description: "GLM 系列" },
      { id: "zai-org/GLM-4.7", label: "GLM-4.7", description: "GLM 通用模型" },
      { id: "zai-org/GLM-5V-Turbo", label: "GLM-5V Turbo", description: "视觉模型" },
      { id: "Qwen/Qwen3-235B-A22B-Instruct-2507", label: "Qwen3 235B", description: "通用大模型" },
      { id: "Qwen/Qwen3-Coder-480B-A35B-Instruct", label: "Qwen3 Coder", description: "代码与 Agent" },
      { id: "Qwen/QwQ-32B", label: "QwQ 32B", description: "推理模型" },
      { id: "moonshotai/Kimi-K2.5", label: "Kimi K2.5", description: "Kimi 系列" },
      { id: "MiniMaxAI/MiniMax-M2.5", label: "MiniMax M2.5", description: "MiniMax 系列" },
      { id: "MiniMaxAI/MiniMax-M2.1", label: "MiniMax M2.1", description: "MiniMax 系列" },
      { id: "openai/gpt-oss-120b", label: "GPT OSS 120B", description: "开源 OpenAI 模型" },
    ],
  },
  {
    id: "custom",
    name: "自定义",
    base_url: "",
    model: "",
    models: [],
  },
];

export function getProviderPreset(provider: string, baseUrl: string): ProviderPreset | null {
  const text = `${provider} ${baseUrl}`.toLowerCase();
  return (
    PROVIDER_PRESETS.find((preset) => {
      if (preset.id === "custom") return false;
      if (text.includes(preset.id.toLowerCase())) return true;
      return preset.aliases?.some((alias) => text.includes(alias.toLowerCase())) ?? false;
    }) ?? null
  );
}

export function getProviderKey(provider: string, baseUrl: string): string {
  const fallback = provider.trim() || baseUrl.trim() || "custom";
  return getProviderPreset(provider, baseUrl)?.id ?? fallback;
}

function mergeModelOptions(...groups: ModelOption[][]): ModelOption[] {
  const seen = new Set<string>();
  const merged: ModelOption[] = [];
  for (const group of groups) {
    for (const option of group) {
      if (!option.id || seen.has(option.id)) continue;
      seen.add(option.id);
      merged.push(option);
    }
  }
  return merged;
}

export function getProviderModelOptions(settings: {
  provider: string;
  base_url: string;
  provider_models?: Record<string, ModelOption[]>;
}): ModelOption[] {
  const preset = getProviderPreset(settings.provider, settings.base_url);
  const providerKey = getProviderKey(settings.provider, settings.base_url);
  const fetched = settings.provider_models?.[providerKey] ?? [];
  const presetModels = preset?.models ?? [];
  return (
    fetched.length > 0 && preset?.id === "siliconflow"
      ? fetched
      : mergeModelOptions(presetModels, fetched)
  );
}

export function findPresetByModelId(model: string): ProviderPreset | null {
  const target = model.trim();
  if (!target) return null;
  return (
    PROVIDER_PRESETS.find(
      (preset) =>
        preset.id !== "custom" && preset.models.some((option) => option.id === target)
    ) ?? null
  );
}

export function getAllModelOptions(settings: {
  provider: string;
  base_url: string;
  model: string;
  provider_models?: Record<string, ModelOption[]>;
}): ModelOption[] {
  const base = getProviderModelOptions(settings);
  if (!settings.model || base.some((m) => m.id === settings.model)) return base;
  return [
    {
      id: settings.model,
      label: settings.model,
      description: "当前设置",
    },
    ...base,
  ];
}

export function getModelOptions(settings: {
  provider: string;
  base_url: string;
  model: string;
  enabled_models?: Record<string, string[]>;
  provider_models?: Record<string, ModelOption[]>;
}): ModelOption[] {
  const all = getAllModelOptions(settings);
  const providerKey = getProviderKey(settings.provider, settings.base_url);
  const enabled = settings.enabled_models?.[providerKey];
  if (!enabled || enabled.length === 0) return all;
  const enabledSet = new Set(enabled);
  const filtered = all.filter((m) => enabledSet.has(m.id));
  return filtered.length > 0 ? filtered : all;
}
