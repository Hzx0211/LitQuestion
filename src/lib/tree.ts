import type { Message } from "./types";
import type { ChatMessage } from "./chat";

export function getLatestMessage(messages: Message[]): Message | null {
  if (messages.length === 0) return null;
  let best = messages[0];
  for (const m of messages) {
    if (m.created_at > best.created_at) best = m;
  }
  return best;
}

export function buildMessageMap(messages: Message[]): Map<string, Message> {
  return new Map(messages.map((m) => [m.id, m]));
}

export function buildChildrenMap(messages: Message[]): Map<string, Message[]> {
  const children = new Map<string, Message[]>();
  for (const m of messages) {
    if (!m.parent_id) continue;
    const arr = children.get(m.parent_id) ?? [];
    arr.push(m);
    children.set(m.parent_id, arr);
  }
  for (const [, arr] of children) {
    arr.sort((a, b) => a.created_at - b.created_at);
  }
  return children;
}

export function getChainToNode(messages: Message[], nodeId: string | null): Message[] {
  if (!nodeId) return [];
  const map = buildMessageMap(messages);
  const chain: Message[] = [];
  let cur: Message | undefined = map.get(nodeId);
  while (cur) {
    chain.push(cur);
    cur = cur.parent_id ? map.get(cur.parent_id) : undefined;
  }
  chain.reverse();
  return chain;
}

export function getLatestDescendant(messages: Message[], nodeId: string): Message {
  const map = buildMessageMap(messages);
  const children = buildChildrenMap(messages);
  const start = map.get(nodeId);
  if (!start) {
    throw new Error(`message not found: ${nodeId}`);
  }
  let cur: Message = start;
  while (true) {
    const arr = children.get(cur.id);
    const next = arr ? arr[arr.length - 1] : undefined;
    if (!next) return cur;
    cur = next;
  }
}

function isOnMainBranch(messages: Message[], nodeId: string): boolean {
  const map = buildMessageMap(messages);
  let cur: Message | undefined = map.get(nodeId);
  while (cur) {
    if (cur.is_branch_root === 1) return false;
    cur = cur.parent_id ? map.get(cur.parent_id) : undefined;
  }
  return true;
}

export function getMainMessages(messages: Message[]): Message[] {
  return messages.filter((m) => isOnMainBranch(messages, m.id));
}

export function getLatestMainLeaf(messages: Message[]): Message | null {
  const main = getMainMessages(messages);
  if (main.length === 0) return null;
  const childrenMap = buildChildrenMap(messages);
  const mainIds = new Set(main.map((m) => m.id));
  const leaves = main.filter((m) => {
    const kids = childrenMap.get(m.id) ?? [];
    return kids.every((k) => !mainIds.has(k.id));
  });
  if (leaves.length === 0) return null;
  let best = leaves[0];
  for (const m of leaves) {
    if (m.created_at > best.created_at) best = m;
  }
  return best;
}

export function collectBranchDescendants(messages: Message[], rootId: string): Message[] {
  const childrenMap = buildChildrenMap(messages);
  const out: Message[] = [];
  const stack: string[] = [rootId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.shift()!;
    const kids = childrenMap.get(id) ?? [];
    for (const k of kids) {
      if (seen.has(k.id)) continue;
      seen.add(k.id);
      out.push(k);
      stack.push(k.id);
    }
  }
  out.sort((a, b) => a.created_at - b.created_at);
  return out;
}

function expandBranchChain(
  messages: Message[],
  rootId: string
): Message[] {
  const root = messages.find((m) => m.id === rootId);
  if (!root) return [];
  const rest = collectBranchDescendants(messages, rootId);
  return [root, ...rest];
}

export function buildMainContext(
  messages: Message[],
  latestMessageId: string,
  system: string | null
): ChatMessage[] {
  const out: ChatMessage[] = [];
  if (system) out.push({ role: "system", content: system });

  const chain = getChainToNode(messages, latestMessageId);
  const childrenMap = buildChildrenMap(messages);
  for (const m of chain) {
    if (m.role === "system") continue;
    out.push({ role: m.role, content: m.content });
    if (m.role === "assistant") {
      const kids = childrenMap.get(m.id) ?? [];
      const includedRoots = kids
        .filter((k) => k.is_branch_root === 1 && k.include_in_main === 1)
        .sort((a, b) => a.created_at - b.created_at);
      for (const root of includedRoots) {
        const chainMsgs = expandBranchChain(messages, root.id);
        for (const bm of chainMsgs) {
          if (bm.role === "system") continue;
          out.push({ role: bm.role, content: bm.content });
        }
      }
    }
  }
  return out;
}

export function buildSideContext(
  messages: Message[],
  anchorId: string,
  branchRootId: string,
  latestSideMessageId: string,
  system: string | null
): ChatMessage[] {
  const out: ChatMessage[] = [];
  if (system) out.push({ role: "system", content: system });

  const mainChain = getChainToNode(messages, anchorId);
  for (const m of mainChain) {
    if (m.role === "system") continue;
    out.push({ role: m.role, content: m.content });
  }

  const map = buildMessageMap(messages);
  const sideChain: Message[] = [];
  let cur: Message | undefined = map.get(latestSideMessageId);
  while (cur) {
    sideChain.push(cur);
    if (cur.id === branchRootId) break;
    cur = cur.parent_id ? map.get(cur.parent_id) : undefined;
  }
  sideChain.reverse();
  for (const m of sideChain) {
    if (m.role === "system") continue;
    out.push({ role: m.role, content: m.content });
  }
  return out;
}
