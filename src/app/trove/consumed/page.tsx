"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import MediaSearch from "@/components/MediaSearch";
import ItemGrid from "@/components/ItemGrid";
import FriendPickerModal from "@/components/FriendPickerModal";

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

export default function ConsumedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [activeTab, setActiveTab] = useState<Category>("book");
  const [addMode, setAddMode] = useState(false);
  const [recommendItem, setRecommendItem] = useState<Item | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  async function recommendToFriend(friendId: string, friendName: string) {
    if (!recommendItem) return;
    try {
      const res = await fetch("/api/recommended/friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: friendId,
          category: recommendItem.category,
          title: recommendItem.title,
          creator: recommendItem.creator,
          coverUrl: recommendItem.cover_url,
        }),
      });
      if (res.ok) {
        setToast(`Sent to ${friendName}`);
      } else if (res.status === 409) {
        setToast(`Already sent to ${friendName}`);
      }
    } catch {
      setToast("Failed to send");
    }
    setRecommendItem(null);
    setTimeout(() => setToast(null), 2500);
  }

  async function reorderItems(updates: { id: string; rank: number }[]) {
    setItems((prev) =>
      prev.map((item) => {
        const update = updates.find((u) => u.id === item.id);
        return update ? { ...item, rank: update.rank } : item;
      })
    );
    await fetch("/api/items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: updates }),
    });
  }

  if (loading || !user) return null;

  const tabs: { key: Category; label: string }[] = [
    { key: "book", label: "Books" },
    { key: "film", label: "Films" },
    { key: "tv", label: "TV Shows" },
  ];

  const counts = {
    book: items.filter((i) => i.category === "book").length,
    film: items.filter((i) => i.category === "film").length,
    tv: items.filter((i) => i.category === "tv").length,
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Profile header */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              @{user.username}
            </h1>
          </div>
          <div className="flex gap-6 text-center">
            {tabs.map((t) => (
              <div key={t.key}>
                <div className="text-2xl font-bold text-foreground">{counts[t.key]}</div>
                <div className="text-xs text-muted">{t.label}</div>
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
                ? "bg-coral text-white"
                : "bg-surface text-muted hover:text-foreground border border-border"
            }`}
          >
            {t.label}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => setAddMode(!addMode)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            addMode
              ? "bg-surface text-muted border border-border"
              : "bg-coral-muted text-coral hover:bg-coral hover:text-white"
          }`}
        >
          {addMode ? "Done" : "+ Add"}
        </button>
      </div>

      {/* Add item */}
      {addMode && (
        <div className="bg-surface rounded-xl border border-border p-4 mb-6">
          <MediaSearch category={activeTab} onSelect={addItem} />
          <p className="text-xs text-muted-light mt-2">
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
        onReorder={reorderItems}
        onRecommend={(item) => setRecommendItem(item)}
      />

      <FriendPickerModal
        isOpen={!!recommendItem}
        onClose={() => setRecommendItem(null)}
        onSelect={recommendToFriend}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-coral/40 text-foreground text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
