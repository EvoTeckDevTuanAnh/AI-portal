"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { askChatGPT, type ChatMessage } from "@/modules/chatgpt/client/bridge-client";
import { listenVietnamese, speakVietnamese } from "@/modules/chatgpt/client/voice";

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function UpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M12 3l5 5M12 3l-5 5M12 3v12" />
      <path d="M4 21h16" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
      <path d="M12 18v4" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="m22 2-7 20-4-9-9-4z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

type Action = {
  title: string;
  prompt: string;
  icon: React.ReactNode;
  bg: string;
  fg: string;
};

type ConversationSummary = {
  id: number;
  title: string;
  status: "active" | "archived";
  updated_at: string;
  message_count: number;
  external_conversation_id: string | null;
};

const PROMPTS = {
  copy: "Help me write marketing copy for my new SaaS product called \"Orbit\".",
  image: "Generate a hero image concept for a fintech dashboard, clean and minimal.",
  avatar: "Create a friendly robot avatar for our brand mascot.",
  code: "Explain the difference between debounce and throttle, with examples.",
};

let nextId = 1;

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${`${s % 60}`.padStart(2, "0")}`;
}

export default function ChatPanel({ onOpenNav }: { onOpenNav?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [externalConversationId, setExternalConversationId] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [statusText, setStatusText] = useState("");
  const [typingPreview, setTypingPreview] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const trimmed = draft.trim();
  const charCount = draft.length;

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/conversations");
    if (response.ok) setConversations(await response.json());
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  const startNewConversation = () => {
    setConversationId(null);
    setExternalConversationId("");
    setMessages([]);
    setHistoryOpen(false);
  };

  const openConversation = async (id: number) => {
    const response = await fetch(`/api/conversations/${id}`);
    if (!response.ok) return;
    const data = await response.json();
    setConversationId(id);
    setExternalConversationId(data.conversation.external_conversation_id ?? "");
    setMessages(data.messages.map((message: { id: number; role: ChatMessage["role"]; content: string }) => ({ id: message.id, role: message.role, content: message.content })));
    setHistoryOpen(false);
  };

  const actions: Action[] = [
    { title: "Write copy", prompt: PROMPTS.copy, icon: <EditIcon />, bg: "bg-blue-50", fg: "text-blue-600" },
    { title: "Image generation", prompt: PROMPTS.image, icon: <StarIcon />, bg: "bg-violet-50", fg: "text-violet-600" },
    { title: "Create avatar", prompt: PROMPTS.avatar, icon: <StarIcon />, bg: "bg-amber-50", fg: "text-amber-600" },
    { title: "Write code", prompt: PROMPTS.code, icon: <EditIcon />, bg: "bg-emerald-50", fg: "text-emerald-600" },
  ];

  // auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  // track scroll position
  const handleScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  };

  // scroll to bottom on new message
  useEffect(() => {
    const el = threadRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [messages, atBottom]);

  const sendMessage = async (voicePrompt?: string) => {
    const text = (voicePrompt ?? draft).trim();
    if (!text) return;
    let activeConversationId = conversationId;
    try {
      if (!activeConversationId) {
        const created = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: text, external_conversation_id: externalConversationId.trim() || null }) });
        if (!created.ok) throw new Error("Không tạo được cuộc trò chuyện");
        const createdConversation = await created.json();
        activeConversationId = createdConversation.id as number;
        setExternalConversationId(createdConversation.external_conversation_id ?? "");
        setConversationId(activeConversationId);
      }
      const savedUser = await fetch(`/api/conversations/${activeConversationId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "user", content: text, status: "completed" }) });
      if (!savedUser.ok) throw new Error("Không lưu được tin nhắn");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Không lưu được cuộc trò chuyện");
      return;
    }
    await loadConversations();
    const userMsg = { id: nextId++, role: "user", content: text } as ChatMessage;
    const assistantId = nextId++;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "", pending: true },
    ]);
    setDraft("");
    setAtBottom(true);
    setSending(true);
    setStatusText("");
    setTypingPreview("");
    setElapsed(0);
    const startedAt = Date.now();
    const elapsedTimer = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 500);
    try {
      const reply = await askChatGPT(
        text,
        (status) => setStatusText(status),
        (stage, detail) => {
          if (stage === "typing" && detail) setTypingPreview(detail);
        },
        externalConversationId.trim() || null,
      );
      clearInterval(elapsedTimer);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, pending: false, content: reply } : m)),
      );
      await fetch(`/api/conversations/${activeConversationId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "assistant", content: reply, status: "completed" }) });
      speakVietnamese(reply);
      await loadConversations();
    } catch (e) {
      clearInterval(elapsedTimer);
      const msg = e instanceof Error ? e.message : "Không kết nối được AI";
      const bridgeDown =
        /fetch failed|ECONNREFUSED|NetworkError|Failed to fetch|could not reach/i.test(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                pending: false,
                content: `⚠️ ${msg}\n\n${
                  bridgeDown
                    ? "AI chưa chạy (cổng kết nối không sẵn sàng). Mở cửa sổ AI rồi thử lại."
                    : "Thử khởi động lại phiên AI nếu lỗi tiếp diễn."
                }`,
              }
            : m,
        ),
      );
      const failure = e instanceof Error ? e.message : "Không kết nối được AI";
      await fetch(`/api/conversations/${activeConversationId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "assistant", content: `⚠️ ${failure}`, status: "failed" }) }).catch(() => {});
    } finally {
      setSending(false);
      setStatusText("");
      setTypingPreview("");
      setElapsed(0);
    }
    textareaRef.current?.focus();
  };

  const handleVoiceMessage = async () => {
    if (sending || listening) return;
    try {
      const transcript = await listenVietnamese(setListening);
      if (transcript) {
        setDraft(transcript);
        await sendMessage(transcript);
      }
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Không nhận diện được giọng nói");
    } finally {
      setListening(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending) sendMessage();
    }
  };

  const applyPrompt = (prompt: string) => {
    setDraft(prompt);
    setAtBottom(false);
    textareaRef.current?.focus();
  };

  const jumpToBottom = () => {
    const el = threadRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      setAtBottom(true);
    }
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface">
      {/* Header */}
      <header className="relative flex h-14 shrink-0 items-center gap-2 border-b border-line bg-card px-5">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-muted hover:bg-gray-100 hover:text-ink lg:hidden"
        >
          <MenuIcon />
        </button>
        <h1 className="text-sm font-semibold text-ink">AI Chat</h1>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          className="flex h-8 items-center rounded-[8px] border border-line px-3 text-[12px] font-medium text-ink-muted hover:bg-gray-50 hover:text-ink"
        >
          History{conversations.length ? ` (${conversations.length})` : ""}
        </button>
        <button
          type="button"
          onClick={startNewConversation}
          className="flex h-8 items-center rounded-[8px] border border-line px-3 text-[12px] font-medium text-ink-muted hover:bg-gray-50 hover:text-ink"
        >
          New chat
        </button>

        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-[8px] bg-ink px-3 text-[13px] font-medium text-card transition-opacity hover:opacity-90"
        >
          <UpIcon />
          Upgrade
        </button>

        <button
          type="button"
          aria-label="Search"
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-muted hover:bg-gray-100 hover:text-ink"
        >
          <SearchIcon />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-muted hover:bg-gray-100 hover:text-ink"
        >
          <BellIcon />
        </button>

        {historyOpen && (
          <div className="absolute right-5 top-12 z-30 w-80 rounded-xl border border-line bg-card p-2 shadow-lg">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-xs font-semibold text-ink">Recent chats</span>
              <button type="button" onClick={startNewConversation} className="text-[11px] text-ink-faint hover:text-ink">New chat</button>
            </div>
            <label className="block px-2 pb-2 text-[11px] text-ink-faint">
              ChatGPT conversation URL/ID
              <input
                value={externalConversationId}
                onChange={(event) => setExternalConversationId(event.target.value)}
                placeholder="https://chatgpt.com/c/..."
                className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-xs text-ink outline-none focus:border-line-strong"
              />
            </label>
            {conversations.length === 0 ? (
              <p className="px-2 py-4 text-xs text-ink-faint">No saved conversations.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {conversations.map((conversation) => (
                  <button key={conversation.id} type="button" onClick={() => void openConversation(conversation.id)} className={`flex w-full flex-col items-start rounded-lg px-2 py-2 text-left hover:bg-gray-50 ${conversation.id === conversationId ? "bg-gray-50" : ""}`}>
                    <span className="w-full truncate text-xs font-medium text-ink">{conversation.title}</span>
                    <span className="text-[11px] text-ink-faint">{conversation.message_count} messages</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Thread */}
      <div ref={threadRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 pt-6 pb-10">
            <div className="flex w-full max-w-lg flex-col items-center -mt-16">
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-lg font-semibold text-card">
                AI
              </span>
              <h2 className="text-center text-2xl font-semibold tracking-tight text-ink">
                Welcome to AI Portal
              </h2>
              <p className="mt-2 text-center text-sm text-ink-muted">
                Ask anything, create anything. Your copilot for ideas, content
                and code.
              </p>
              <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {actions.map((action) => (
                  <button
                    key={action.title}
                    type="button"
                    onClick={() => applyPrompt(action.prompt)}
                    className="group flex items-center gap-3 rounded-[10px] border border-line bg-card px-4 py-3.5 text-left transition-colors hover:bg-gray-50"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${action.bg} ${action.fg}`}
                    >
                      {action.icon}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-ink">
                      {action.title}
                    </span>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-faint group-hover:bg-gray-100 group-hover:text-ink">
                      <PlusIcon />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-6 py-6">
            {messages.map((m) => (
              <div key={m.id} className="flex gap-3">
                {m.role === "assistant" ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-xs font-semibold text-card">
                    AI
                  </span>
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-ink">
                    CK
                  </span>
                )}
                <div className="min-w-0 pt-1">
                  <p className="mb-1 text-[11px] font-medium text-ink-faint">
                    {m.role === "assistant" ? "AI Portal" : "You"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {m.content}
                  </p>
                  {m.pending && (
                    <div className="mt-1.5 space-y-1">
                      {statusText && (
                        <p className="text-xs text-ink-faint">
                          {statusText} <span className="tabular-nums">({formatTime(elapsed)})</span>
                        </p>
                      )}
                      {typingPreview && (
                        <p className="whitespace-pre-wrap text-sm italic leading-relaxed text-ink-muted">
                          {typingPreview}▍
                        </p>
                      )}
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:300ms]" />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* jump-to-bottom */}
        {messages.length > 0 && !atBottom && (
          <button
            type="button"
            onClick={jumpToBottom}
            aria-label="Scroll to bottom"
            className="absolute bottom-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-card text-ink-muted shadow-sm hover:text-ink"
          >
            <ArrowDownIcon />
          </button>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 px-6 pb-5">
        <div className="mx-auto flex w-full max-w-[760px] flex-col rounded-2xl border border-line bg-card p-2.5 focus-within:border-line-strong">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message AI Portal…"
            rows={1}
            className="max-h-[200px] w-full resize-none bg-transparent px-2 py-1 text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-faint"
          />

          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              aria-label="Attach"
              title="Attach"
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-muted hover:bg-gray-100 hover:text-ink"
            >
              <PaperclipIcon />
            </button>
            <button
              type="button"
              onClick={() => void handleVoiceMessage()}
              aria-label="Voice message"
              title="Voice message"
              className={`flex h-8 w-8 items-center justify-center rounded-[8px] ${listening ? "bg-red-50 text-red-600" : "text-ink-muted hover:bg-gray-100 hover:text-ink"}`}
            >
              <MicIcon />
            </button>
            <button
              type="button"
              title="Browse prompts"
              className="flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[12px] font-medium text-ink-muted hover:bg-gray-100 hover:text-ink"
            >
              <SparkIcon />
              Browse Prompts
            </button>

            <div className="flex-1" />

            {charCount > 0 && (
              <span className="mr-1 text-[11px] tabular-nums text-ink-faint">
                {charCount}
              </span>
            )}

            <button
              type="button"
              onClick={() => { if (!sending) sendMessage(); }}
              disabled={!trimmed || sending}
              aria-label="Send message"
              className={`flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors ${
                trimmed
                  ? "bg-ink text-card hover:opacity-90"
                  : "cursor-not-allowed bg-gray-100 text-ink-faint"
              }`}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
