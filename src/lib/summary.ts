import type { Settings } from "./types";
import { streamChat } from "./chat";

function normalizeTitle(text: string, maxLen: number): string {
  const compact = text
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[“”"【】[\]{}]/g, "")
    .trim();
  if (!compact) return "";
  return compact.slice(0, maxLen);
}

async function summarizeByModel(
  settings: Settings,
  prompt: string,
  maxLen: number
): Promise<string | null> {
  let output = "";
  let failed = false;
  const handle = streamChat({
    provider: settings.provider,
    base_url: settings.base_url,
    model: settings.model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "你是一个标题提炼助手。请输出简短、准确、可读的中文标题。不要解释，不要加标点结尾，不要加引号。",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    onDelta(piece) {
      output += piece;
    },
    onDone() {
      // no-op
    },
    onError() {
      failed = true;
    },
  });
  await handle.done;
  if (failed) return null;
  const title = normalizeTitle(output, maxLen);
  return title || null;
}

export async function summarizeConversationTitle(
  settings: Settings,
  userPrompt: string
): Promise<string | null> {
  const text = userPrompt.trim();
  if (!text) return null;
  if (text.length <= 14) return normalizeTitle(text, 20);
  return summarizeByModel(
    settings,
    `请把下面这条用户提问提炼成一个 6-14 字的中文对话标题：\n${text}`,
    20
  );
}

export async function summarizeNodeTitle(
  settings: Settings,
  content: string,
  role: "user" | "assistant"
): Promise<string | null> {
  const text = content.trim();
  if (!text) return null;
  if (text.length <= 16) return normalizeTitle(text, 22);
  const who = role === "assistant" ? "AI 回复" : "用户提问";
  return summarizeByModel(
    settings,
    `下面是一段${who}内容，请提炼成一个 6-16 字中文节点标题：\n${text}`,
    24
  );
}

export async function summarizeBranchTitle(
  settings: Settings,
  content: string
): Promise<string | null> {
  const text = content.trim();
  if (!text) return null;
  if (text.length <= 16) return normalizeTitle(text, 20);
  return summarizeByModel(
    settings,
    `下面是用户在侧窗口发起的追问，请提炼成一个 6-14 字中文分支名：\n${text}`,
    20
  );
}
