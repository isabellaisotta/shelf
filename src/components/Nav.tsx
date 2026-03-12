"use client";

import Link from "next/link";
import { useAuth } from "./AuthContext";

export default function Nav() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav className="bg-surface border-b border-border px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/profile" className="hover:opacity-80 transition-opacity">
          <img src="/logo.svg" alt="Shelf" className="h-8" />
        </Link>
        <Link href="/profile" className="text-sm text-muted hover:text-foreground transition-colors">
          My Shelf
        </Link>
        <Link href="/friends" className="text-sm text-muted hover:text-foreground transition-colors">
          Friends
        </Link>
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
  );
}
