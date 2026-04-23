import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { nanoid } from "nanoid";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatStreamParams {
  provider: string;
  base_url: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  onDelta: (text: string) => void;
  onDone: (info: { cancelled: boolean }) => void;
  onError: (message: string) => void;
}

export interface ChatStreamHandle {
  request_id: string;
  cancel: () => Promise<void>;
  done: Promise<void>;
}

export function streamChat(params: ChatStreamParams): ChatStreamHandle {
  const request_id = nanoid();
  const unlisten: UnlistenFn[] = [];
  let settled = false;

  const done = new Promise<void>((resolve) => {
    (async () => {
      unlisten.push(
        await listen<string>(`chat://delta/${request_id}`, (e) => {
          params.onDelta(e.payload);
        })
      );
      unlisten.push(
        await listen<{ cancelled: boolean }>(`chat://done/${request_id}`, (e) => {
          if (settled) return;
          settled = true;
          params.onDone(e.payload);
          unlisten.forEach((u) => u());
          resolve();
        })
      );
      unlisten.push(
        await listen<string>(`chat://error/${request_id}`, (e) => {
          if (settled) return;
          settled = true;
          params.onError(e.payload);
          unlisten.forEach((u) => u());
          resolve();
        })
      );

      try {
        await invoke("chat_stream", {
          req: {
            request_id,
            provider: params.provider,
            base_url: params.base_url,
            model: params.model,
            messages: params.messages,
            temperature: params.temperature ?? null,
            max_tokens: params.max_tokens ?? null,
          },
        });
      } catch (err) {
        if (!settled) {
          settled = true;
          params.onError(String(err));
          unlisten.forEach((u) => u());
          resolve();
        }
      }
    })();
  });

  return {
    request_id,
    async cancel() {
      try {
        await invoke("chat_cancel", { requestId: request_id, request_id });
      } catch {
        // ignore
      }
    },
    done,
  };
}
