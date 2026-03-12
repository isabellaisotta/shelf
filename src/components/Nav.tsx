"use client";

import Link from "next/link";
import { useAuth } from "./AuthContext";

export default function Nav() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/profile" className="text-xl font-bold text-indigo-600 hover:text-indigo-700">
          TasteMatch
        </Link>
        <Link href="/profile" className="text-sm text-gray-600 hover:text-gray-900">
          My Profile
        </Link>
        <Link href="/friends" className="text-sm text-gray-600 hover:text-gray-900">
          Friends
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">@{user.username}</span>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
