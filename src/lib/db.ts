import Database from "@tauri-apps/plugin-sql";
import type { Conversation, Message, Role } from "./types";

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:litquestion.db");
  }
  return dbPromise;
}

export async function listConversations(): Promise<Conversation[]> {
  const db = await getDb();
  return db.select<Conversation[]>(
    "SELECT * FROM conversations ORDER BY updated_at DESC"
  );
}

export async function createConversation(params: {
  id: string;
  title: string;
  model: string | null;
  provider: string | null;
  base_url: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.execute(
    `INSERT INTO conversations (id, title, model, provider, base_url, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)`,
    [params.id, params.title, params.model, params.provider, params.base_url, now]
  );
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE conversations SET title = $1, updated_at = $2 WHERE id = $3",
    [title, Date.now(), id]
  );
}

export async function touchConversation(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE conversations SET updated_at = $1 WHERE id = $2",
    [Date.now(), id]
  );
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM conversations WHERE id = $1", [id]);
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const db = await getDb();
  return db.select<Message[]>(
    "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
    [conversationId]
  );
}

export async function insertMessage(m: {
  id: string;
  conversation_id: string;
  parent_id: string | null;
  role: Role;
  content: string;
  is_branch_root?: boolean;
  branch_label?: string | null;
  include_in_main?: boolean;
}): Promise<Message> {
  const db = await getDb();
  const created_at = Date.now();
  await db.execute(
    `INSERT INTO messages (id, conversation_id, parent_id, role, content, is_branch_root, branch_label, include_in_main, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      m.id,
      m.conversation_id,
      m.parent_id,
      m.role,
      m.content,
      m.is_branch_root ? 1 : 0,
      m.branch_label ?? null,
      m.include_in_main ? 1 : 0,
      created_at,
    ]
  );
  await touchConversation(m.conversation_id);
  return {
    id: m.id,
    conversation_id: m.conversation_id,
    parent_id: m.parent_id,
    role: m.role,
    content: m.content,
    is_branch_root: m.is_branch_root ? 1 : 0,
    branch_label: m.branch_label ?? null,
    node_label: null,
    include_in_main: m.include_in_main ? 1 : 0,
    highlighted: 0,
    created_at,
  };
}

export async function updateMessageNodeLabel(
  id: string,
  nodeLabel: string | null
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE messages SET node_label = $1 WHERE id = $2", [nodeLabel, id]);
}

export async function updateMessageHighlight(
  id: string,
  highlighted: boolean
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE messages SET highlighted = $1 WHERE id = $2", [
    highlighted ? 1 : 0,
    id,
  ]);
}

export async function updateMessageContent(id: string, content: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE messages SET content = $1 WHERE id = $2", [content, id]);
}

export async function updateMessageBranchLabel(
  id: string,
  branchLabel: string | null
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE messages SET branch_label = $1 WHERE id = $2", [branchLabel, id]);
}

export async function updateIncludeInMainForIds(
  ids: string[],
  value: boolean
): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
  await db.execute(
    `UPDATE messages SET include_in_main = $1 WHERE id IN (${placeholders})`,
    [value ? 1 : 0, ...ids]
  );
}

export async function deleteMessage(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM messages WHERE id = $1", [id]);
}
