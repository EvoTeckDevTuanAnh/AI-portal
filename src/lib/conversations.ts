import { db } from "@/lib/db";
import { normalizeExternalConversationId, normalizeTitle, titleFromPrompt, validateMessage, type ConversationStatus, type MessageStatus, type MessageRole } from "@/lib/conversation-domain";

export type Conversation = { id: number; title: string; external_conversation_id: string | null; status: ConversationStatus; created_at: string; updated_at: string; archived_at: string | null; message_count: number };
export type ConversationMessage = { id: number; conversation_id: number; role: MessageRole; content: string; status: MessageStatus; metadata: Record<string, unknown>; created_at: string };

type ConversationRow = { id: number; title: string; external_conversation_id: string | null; status: ConversationStatus; created_at: Date | string; updated_at: Date | string; archived_at: Date | string | null; message_count: string | number };
type MessageRow = { id: number; conversation_id: number; role: MessageRole; content: string; status: MessageStatus; metadata: Record<string, unknown>; created_at: Date | string };
const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : String(value);

function mapConversation(row: ConversationRow): Conversation { return { ...row, id: Number(row.id), message_count: Number(row.message_count), created_at: iso(row.created_at), updated_at: iso(row.updated_at), archived_at: row.archived_at ? iso(row.archived_at) : null }; }
function mapMessage(row: MessageRow): ConversationMessage { return { ...row, id: Number(row.id), conversation_id: Number(row.conversation_id), created_at: iso(row.created_at) }; }

export async function listConversations(search?: string, includeArchived = false): Promise<Conversation[]> {
  const term = search?.trim() || null;
  const result = await db.query<ConversationRow>(`SELECT c.*, COUNT(m.id)::int AS message_count FROM conversations c LEFT JOIN conversation_messages m ON m.conversation_id = c.id WHERE ($1::text IS NULL OR c.title ILIKE '%' || $1 || '%' OR EXISTS (SELECT 1 FROM conversation_messages sm WHERE sm.conversation_id = c.id AND sm.content ILIKE '%' || $1 || '%')) AND ($2::boolean OR c.status = 'active') GROUP BY c.id ORDER BY c.updated_at DESC`, [term, includeArchived]);
  return result.rows.map(mapConversation);
}

export async function getConversation(id: number): Promise<{ conversation: Conversation; messages: ConversationMessage[] } | null> {
  const conversation = await db.query<ConversationRow>(`SELECT c.*, COUNT(m.id)::int AS message_count FROM conversations c LEFT JOIN conversation_messages m ON m.conversation_id = c.id WHERE c.id = $1 GROUP BY c.id`, [id]);
  if (!conversation.rowCount) return null;
  const messages = await db.query<MessageRow>(`SELECT id, conversation_id, role, content, status, metadata, created_at FROM conversation_messages WHERE conversation_id = $1 ORDER BY created_at, id`, [id]);
  return { conversation: mapConversation(conversation.rows[0]), messages: messages.rows.map(mapMessage) };
}

export async function createConversation(title?: unknown, externalConversationId?: unknown): Promise<Conversation> {
  const result = await db.query<ConversationRow>(`INSERT INTO conversations (title, external_conversation_id) VALUES ($1, $2) RETURNING *, 0::int AS message_count`, [normalizeTitle(title), normalizeExternalConversationId(externalConversationId)]);
  return mapConversation(result.rows[0]);
}

export async function updateConversation(id: number, input: { title?: unknown; status?: unknown; external_conversation_id?: unknown }): Promise<Conversation | null> {
  const status = input.status === undefined ? null : input.status;
  if (status !== null && status !== "active" && status !== "archived") throw new Error("invalid conversation status");
  const result = await db.query<ConversationRow>(`UPDATE conversations SET title = COALESCE($1, title), external_conversation_id = COALESCE($2, external_conversation_id), status = COALESCE($3, status), archived_at = CASE WHEN $3 = 'archived' THEN COALESCE(archived_at, now()) WHEN $3 = 'active' THEN NULL ELSE archived_at END, updated_at = now() WHERE id = $4 RETURNING *, (SELECT COUNT(*) FROM conversation_messages m WHERE m.conversation_id = conversations.id)::int AS message_count`, [input.title === undefined ? null : normalizeTitle(input.title), input.external_conversation_id === undefined ? null : normalizeExternalConversationId(input.external_conversation_id), status, id]);
  return result.rowCount ? mapConversation(result.rows[0]) : null;
}

export async function deleteConversation(id: number): Promise<boolean> { const result = await db.query(`DELETE FROM conversations WHERE id = $1`, [id]); return (result.rowCount ?? 0) > 0; }

export async function appendMessage(id: number, input: { role: unknown; content: unknown; status?: unknown; metadata?: Record<string, unknown> }): Promise<ConversationMessage | null> {
  const message = validateMessage(input.role, input.content, input.status);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const conversation = await client.query(`SELECT id, status FROM conversations WHERE id = $1 FOR UPDATE`, [id]);
    if (!conversation.rowCount) { await client.query("ROLLBACK"); return null; }
    if (conversation.rows[0].status === "archived") throw new Error("conversation is archived");
    const result = await client.query<MessageRow>(`INSERT INTO conversation_messages (conversation_id, role, content, status, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING id, conversation_id, role, content, status, metadata, created_at`, [id, message.role, message.content.trim(), message.status, JSON.stringify(input.metadata ?? {})]);
    const title = message.role === "user" ? titleFromPrompt(message.content) : null;
    await client.query(`UPDATE conversations SET title = CASE WHEN title = 'New conversation' AND $1::text IS NOT NULL THEN $1::text ELSE title END, updated_at = now() WHERE id = $2`, [title, id]);
    await client.query("COMMIT");
    return mapMessage(result.rows[0]);
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
