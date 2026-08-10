export type ConversationStatus = "active" | "archived";
export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "pending" | "completed" | "failed";

export function normalizeTitle(title: unknown, fallback = "New conversation"): string {
  const value = typeof title === "string" ? title.trim() : "";
  return (value || fallback).slice(0, 160);
}

export function titleFromPrompt(prompt: string): string {
  return normalizeTitle(prompt.replace(/\s+/g, " "), "New conversation");
}

export function normalizeExternalConversationId(value: unknown): string | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const candidate = raw.startsWith("http://") || raw.startsWith("https://")
    ? (() => {
        try {
          const url = new URL(raw);
          if (url.hostname !== "chatgpt.com" && url.hostname !== "chat.openai.com") return null;
          return url.pathname.match(/^\/c\/([0-9a-f-]{36})\/?$/i)?.[1] ?? null;
        } catch { return null; }
      })()
    : raw;
  if (!candidate || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)) throw new Error("external_conversation_id must be a ChatGPT conversation UUID or URL");
  return candidate;
}

export function validateMessage(role: unknown, content: unknown, status: unknown): { role: MessageRole; content: string; status: MessageStatus } {
  if (role !== "user" && role !== "assistant" && role !== "system") throw new Error("invalid message role");
  if (typeof content !== "string" || !content.trim()) throw new Error("message content is required");
  if (status !== undefined && status !== "pending" && status !== "completed" && status !== "failed") throw new Error("invalid message status");
  return { role, content, status: status ?? "completed" };
}
