"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import ChatPanel from "@/modules/chatgpt/client/chat-panel";

export default function GlobalChatBox() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // The home page already renders the full-size chat experience.
  if (pathname === "/") return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-50 h-[min(560px,calc(100vh-6rem))] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
          <ChatPanel variant="widget" />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close AI chat" : "Open AI chat"}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-ink px-5 py-3 text-sm font-medium text-card shadow-lg transition-transform hover:scale-105"
      >
        {open ? "Close" : "AI Chat"}
      </button>
    </>
  );
}
