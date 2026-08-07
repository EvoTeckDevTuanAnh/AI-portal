"use client";

import { useState } from "react";

type NavItem = {
  label: string;
  icon: React.ReactNode;
  badge?: string;
};

const ICON_SIZE = "h-4 w-4";

function SearchIcon() {
  return (
    <svg className={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5a2 2 0 0 1 2-2h4l2 3h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg className={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4z" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg className={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg className={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={collapsed ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} />
    </svg>
  );
}

function NavItem({
  item,
  collapsed,
  active,
  onNavigate,
}: {
  item: IconItem;
  collapsed: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={`flex h-[38px] w-full items-center gap-3 rounded-[9px] px-3 text-left transition-colors ${
        active
          ? "bg-gray-100 text-ink"
          : "text-ink-muted hover:bg-gray-50 hover:text-ink"
      }`}
    >
      <span className={`flex shrink-0 ${collapsed ? "mx-auto" : ""}`}>{item.icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-[13px] font-medium">{item.label}</span>
          {item.badge && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              {item.badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}

type IconItem = { label: string; icon: React.ReactNode; badge?: string };

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState("ai-chat");

  const mainItems: IconItem[] = [
    { label: "AI Chat", icon: <ChatIcon /> },
    { label: "Projects", icon: <FolderIcon /> },
    { label: "Templates", icon: <FileIcon /> },
    { label: "Documents", icon: <DocIcon /> },
    { label: "Community", icon: <UsersIcon />, badge: "NEW" },
    { label: "History", icon: <HistoryIcon /> },
  ];

  const footerItems: IconItem[] = [
    { label: "Settings", icon: <SettingsIcon /> },
    { label: "Help", icon: <HelpIcon /> },
  ];

  return (
    <aside
      className={`hidden h-full shrink-0 flex-col border-r border-line bg-card transition-[width] duration-200 lg:flex ${
        collapsed ? "w-[68px]" : "w-60"
      }`}
    >
      {/* Top */}
      <div
        className={`flex h-14 shrink-0 items-center gap-2 border-b border-line ${
          collapsed ? "justify-center px-2" : "px-4"
        }`}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink text-[11px] font-semibold text-card">
          AI
        </span>
        {!collapsed && (
          <span className="flex-1 truncate text-sm font-semibold text-ink">
            AI Portal
          </span>
        )}
        {!collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-gray-100 hover:text-ink"
          >
            <CollapseIcon collapsed />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-gray-100 hover:text-ink"
          >
            <CollapseIcon collapsed />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="shrink-0 px-3 pt-4">
        {collapsed ? (
          <button
            type="button"
            title="Search"
            className="flex h-[38px] w-full items-center justify-center rounded-[9px] border border-line text-ink-muted hover:bg-gray-50"
          >
            <SearchIcon />
          </button>
        ) : (
          <label className="flex h-[38px] w-full cursor-text items-center gap-2 rounded-[9px] border border-line bg-surface px-3 text-ink-faint focus-within:border-line-strong">
            <span className="flex shrink-0">
              <SearchIcon />
            </span>
            <input
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
            />
            <kbd className="shrink-0 rounded border border-line bg-card px-1.5 py-0.5 text-[10px] font-medium text-ink-faint">
              ⌘K
            </kbd>
          </label>
        )}
      </div>

      {/* Main nav */}
      <nav className="mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
        {mainItems.map((item) => (
          <NavItem
            key={item.label}
            item={item}
            collapsed={collapsed}
            active={active === item.label}
            onNavigate={() => setActive(item.label)}
          />
        ))}
      </nav>

      {/* Footer group + bottom */}
      <div className="shrink-0">
        <div className="flex flex-col gap-0.5 px-3 pb-2">
          {footerItems.map((item) => (
            <NavItem
              key={item.label}
              item={item}
              collapsed={collapsed}
              active={active === item.label}
              onNavigate={() => setActive(item.label)}
            />
          ))}
        </div>

        {/* Light/Dark toggle */}
        <div className="border-t border-line px-3 py-2">
          {collapsed ? (
            <button
              type="button"
              title="Toggle theme"
              className="flex h-[38px] w-full items-center justify-center rounded-[9px] text-ink-muted hover:bg-gray-50 hover:text-ink"
            >
              <MoonIcon />
            </button>
          ) : (
            <button
              type="button"
              className="flex h-[38px] w-full items-center gap-2 rounded-[9px] px-3 text-ink-muted hover:bg-gray-50 hover:text-ink"
            >
              <MoonIcon />
              <span className="text-[13px] font-medium">Dark mode</span>
            </button>
          )}
        </div>

        {/* Avatar */}
        <div
          className={`flex items-center border-t border-line py-2 ${
            collapsed ? "justify-center px-2" : "px-3"
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-ink">
            CK
          </span>
          {!collapsed && (
            <div className="ml-2.5 min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight text-ink">
                Chris Kim
              </p>
              <p className="truncate text-[11px] leading-tight text-ink-faint">
                chris@acme.com
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}