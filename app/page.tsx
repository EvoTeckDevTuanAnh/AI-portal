"use client";

import { useState } from "react";
import Sidebar from "@/components/sidebar";
import MainContent from "@/components/main-content";
import ProjectsPanel from "@/components/projects-panel";

export default function Dashboard() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface">
      <Sidebar />
      <MainContent onOpenNav={() => setNavOpen(true)} />
      <ProjectsPanel />

      {/* Mobile drawer (sidebar + projects) */}
      {navOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setNavOpen(false)}
          />
          <div className="relative z-10 flex h-full w-[320px] max-w-[85%]" onClick={(e) => e.stopPropagation()}>
            <Sidebar />
          </div>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            className="absolute right-4 top-4 rounded-md bg-card px-2 py-1 text-xs font-medium text-ink shadow-sm"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}