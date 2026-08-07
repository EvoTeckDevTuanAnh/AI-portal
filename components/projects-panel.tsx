"use client";

const projects = [
  {
    id: "p1",
    title: "Learning From 100 Years of…",
    preview: "A broad review of marketing history and what it teaches us.",
  },
  {
    id: "p2",
    title: "Research officiants",
    preview: "Collecting best practices for wedding officiant selection.",
  },
  {
    id: "p3",
    title: "What does a senior lead…",
    preview: "Leadership expectations, scope and responsibilities.",
  },
  {
    id: "p4",
    title: "Write a sweet note to your…",
    preview: "Draft warm, personal messages for the recipient.",
  },
  {
    id: "p5",
    title: "Meet with cake bakers",
    preview: "Agenda and questions for the wedding tasting session.",
  },
  {
    id: "p6",
    title: "Physical space is often…",
    preview: "Notes on how offices shape team behavior and culture.",
  },
];

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
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

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function ProjectsPanel() {
  return (
    <aside className="relative hidden h-full w-[320px] shrink-0 flex-col border-l border-line bg-card min-[1200px]:flex">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-5">
        <h2 className="flex-1 text-sm font-semibold text-ink">
          Projects <span className="font-normal text-ink-faint">(7)</span>
        </h2>
        <button
          type="button"
          aria-label="More options"
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-muted hover:bg-gray-100 hover:text-ink"
        >
          <MoreIcon />
        </button>
      </div>

      {/* New project */}
      <div className="shrink-0 px-5 pt-4">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-[9px] bg-ink px-3 py-2 text-[13px] font-medium text-card transition-opacity hover:opacity-90"
        >
          <PlusIcon />
          New Project
        </button>
      </div>

      {/* List */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
        {projects.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-0.5 rounded-[9px] border border-line bg-card px-3 py-2.5 transition-colors hover:bg-gray-50"
          >
            <p className="truncate text-[13px] font-medium text-ink">{p.title}</p>
            <p className="truncate text-xs text-ink-faint">{p.preview}</p>
          </div>
        ))}
      </div>

      {/* Floating chat button */}
      <div className="pointer-events-none absolute bottom-5 right-5 z-20">
        <button
          type="button"
          aria-label="Chat support"
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-card shadow-sm transition-opacity hover:opacity-90"
        >
          <ChatIcon />
          Chat
        </button>
      </div>
    </aside>
  );
}