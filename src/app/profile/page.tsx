"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import MediaSearch from "@/components/MediaSearch";
import ItemGrid from "@/components/ItemGrid";

interface Item {
  id: string;
  category: string;
  title: string;
  creator: string;
  year: string;
  cover_url: string;
  rank: number;
}

type Category = "book" | "film" | "tv";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [activeTab, setActiveTab] = useState<Category>("book");
  const [addMode, setAddMode] = useState(false);

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/items");
    const data = await res.json();
    setItems(data.items || []);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) loadItems();
  }, [user, loading, router, loadItems]);

  async function addItem(result: { title: string; creator: string; year: string; coverUrl: string; externalId: string }) {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: activeTab, ...result }),
    });
    if (res.ok) {
      await loadItems();
    }
  }

  async function deleteItem(id: string) {
    await fetch("/api/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadItems();
  }

  if (loading || !user) return null;

  const tabs: { key: Category; label: string; emoji: string }[] = [
    { key: "book", label: "Books", emoji: "📚" },
    { key: "film", label: "Films", emoji: "🎬" },
    { key: "tv", label: "TV Shows", emoji: "📺" },
  ];

  const counts = {
    book: items.filter((i) => i.category === "book").length,
    film: items.filter((i) => i.category === "film").length,
    tv: items.filter((i) => i.category === "tv").length,
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Profile header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {user.display_name || user.username}
            </h1>
            <p className="text-gray-500">@{user.username}</p>
          </div>
          <div className="flex gap-6 text-center">
            {tabs.map((t) => (
              <div key={t.key}>
                <div className="text-2xl font-bold text-gray-900">{counts[t.key]}</div>
                <div className="text-xs text-gray-500">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); setAddMode(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => setAddMode(!addMode)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            addMode
              ? "bg-gray-200 text-gray-700"
              : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
          }`}
        >
          {addMode ? "Done" : "+ Add"}
        </button>
      </div>

      {/* Add item */}
      {addMode && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <MediaSearch category={activeTab} onSelect={addItem} />
          <p className="text-xs text-gray-400 mt-2">
            Search and select to add to your {activeTab === "tv" ? "TV shows" : activeTab + "s"}
          </p>
        </div>
      )}

      {/* Grid */}
      <ItemGrid
        items={items}
        category={activeTab}
        editable
        onDelete={deleteItem}
      />
    </div>
  );
}
