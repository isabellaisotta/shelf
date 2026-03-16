"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthContext";

const tabs = [
  { label: "My Trove", href: "/trove", icon: "📚" },
  { label: "Explore", href: "/explore", icon: "🔍" },
  { label: "Messages", href: "/messages", icon: "💬" },
  { label: "Friends", href: "/social", icon: "👥" },
];

export default function TabBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  function isActive(href: string) {
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Desktop: top bar */}
      <nav className="hidden md:flex bg-surface border-b border-border px-6 py-3 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/trove" className="hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="Trove" className="h-8" />
          </Link>
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`text-sm font-medium transition-colors ${
                isActive(tab.href)
                  ? "text-coral"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-light">@{user.username}</span>
          <button
            onClick={logout}
            className="text-sm text-muted-light hover:text-foreground transition-colors"
          >
            Log out
          </button>
        </div>
      </nav>

      {/* Mobile: slim top bar */}
      <nav className="md:hidden bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <Link href="/trove" className="hover:opacity-80 transition-opacity">
          <img src="/logo.svg" alt="Trove" className="h-7" />
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-light">@{user.username}</span>
          <button
            onClick={logout}
            className="text-sm text-muted-light hover:text-foreground transition-colors"
          >
            Log out
          </button>
        </div>
      </nav>

      {/* Mobile: bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40 flex">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center py-2.5 text-xs font-medium transition-colors ${
              isActive(tab.href)
                ? "text-coral"
                : "text-muted"
            }`}
          >
            <span className="text-lg mb-0.5">{tab.icon}</span>
            {tab.label}
          </Link>
        ))}
      </div>
    </>
  );
}
