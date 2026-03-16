"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import MediaSearch from "@/components/MediaSearch";

interface RecommendedItem {
  id: string;
  category: string;
  title: string;
  creator: string;
  source: string;
  source_type: "self" | "ai" | "friend" | "from-shelf";
  notes: string;
  created_at: string;
  table: "recommended" | "friend_recommendations";
  status?: string;
}

type Category = "all" | "book" | "film" | "tv";

export default function ToConsumePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<RecommendedItem[]>([]);
  const [activeTab, setActiveTab] = useState<Category>("all");
  const [addMode, setAddMode] = useState(false);
  const [addCategory, setAddCategory] = useState<"book" | "film" | "tv">("book");

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/recommended");
    const data = await res.json();
    setItems(data.items || []);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) loadItems();
  }, [user, loading, router, loadItems]);

  async function addItem(result: { title: string; creator: string; year: string; coverUrl: string; externalId: string }) {
    const res = await fetch("/api/recommended", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: addCategory,
        title: result.title,
        creator: result.creator,
        source: "Added by you",
      }),
    });
    if (res.ok) {
      await loadItems();
    }
  }

  async function removeItem(id: string, table: string) {
    await fetch("/api/recommended", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, table }),
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  if (loading || !user) return null;

  const tabs: { key: Category; label: string }[] = [
    { key: "all", label: "All" },
    { key: "book", label: "Books" },
    { key: "film", label: "Films" },
    { key: "tv", label: "TV Shows" },
  ];

  const nonPending = items.filter((i) => !(i.source_type === "friend" && i.status === "pending"));
  const filtered = activeTab === "all" ? nonPending : nonPending.filter((i) => i.category === activeTab);

  const counts = {
    all: items.length,
    book: items.filter((i) => i.category === "book").length,
    film: items.filter((i) => i.category === "film").length,
    tv: items.filter((i) => i.category === "tv").length,
  };

  const addCategoryTabs: { key: "book" | "film" | "tv"; label: string }[] = [
    { key: "book", label: "Books" },
    { key: "film", label: "Films" },
    { key: "tv", label: "TV Shows" },
  ];

  function sourceLabel(item: RecommendedItem) {
    if (item.source_type === "friend") return item.source;
    if (item.source_type === "ai") return item.source;
    if (item.source_type === "from-shelf") return item.source;
    return "Added by you";
  }

  function sourceColor() {
    return "text-coral";
  }

  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  function startEditNotes(item: RecommendedItem) {
    setEditingNotes(item.id);
    setNotesValue(item.notes || "");
  }

  async function saveNotes(id: string) {
    const item = items.find((i) => i.id === id);
    await fetch("/api/recommended", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, notes: notesValue, table: item?.table }),
    });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, notes: notesValue } : i));
    setEditingNotes(null);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">To Consume</h1>
            <p className="text-sm text-muted mt-1">Things to watch, read, and binge</p>
          </div>
          <div className="flex gap-6 text-center">
            {tabs.slice(1).map((t) => (
              <div key={t.key}>
                <div className="text-2xl font-bold text-coral">{counts[t.key]}</div>
                <div className="text-xs text-muted">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs + Add button */}
      <div className="flex items-center gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-coral text-white"
                : "bg-surface text-muted hover:text-foreground border border-border"
            }`}
          >
            {t.label} ({counts[t.key]})
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
          <div className="flex gap-2 mb-3">
            {addCategoryTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setAddCategory(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  addCategory === t.key
                    ? "bg-coral text-white"
                    : "bg-background text-muted border border-border hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <MediaSearch category={addCategory} onSelect={addItem} />
          <p className="text-xs text-muted-light mt-2">
            Search and select to add to To Consume
          </p>
        </div>
      )}

      {/* Items */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <p className="text-lg mb-2">No items yet</p>
          <p className="text-sm text-muted-light">
            Add your own, get AI picks from taste comparisons, or have friends recommend things to you
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group bg-surface rounded-xl border border-border p-4 hover:border-coral/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-coral-muted flex items-center justify-center">
                  <span className="text-coral text-xs font-bold uppercase">
                    {item.category === "book" ? "BK" : item.category === "film" ? "FM" : "TV"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">{item.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.creator && (
                      <span className="text-sm text-muted">{item.creator}</span>
                    )}
                    {item.creator && <span className="text-muted-light">·</span>}
                    <span className={`text-xs ${sourceColor()}`}>{sourceLabel(item)}</span>
                    {editingNotes === item.id ? (
                      <>
                        <span className="text-muted-light">·</span>
                        <input
                          type="text"
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveNotes(item.id);
                            if (e.key === "Escape") setEditingNotes(null);
                          }}
                          placeholder="Add a note..."
                          autoFocus
                          className="text-sm px-2 py-0.5 bg-background border border-border rounded text-foreground placeholder:text-muted-light focus:ring-1 focus:ring-coral focus:border-transparent"
                        />
                        <button
                          onClick={() => saveNotes(item.id)}
                          className="text-xs text-coral hover:text-coral-hover font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingNotes(null)}
                          className="text-xs text-muted-light hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </>
                    ) : item.notes ? (
                      <>
                        <span className="text-muted-light">·</span>
                        <span
                          onClick={() => startEditNotes(item)}
                          className="text-xs text-muted cursor-pointer hover:text-foreground transition-colors"
                        >
                          {item.notes}
                        </span>
                      </>
                    ) : (
                      <button
                        onClick={() => startEditNotes(item)}
                        className="text-xs text-muted-light hover:text-muted transition-colors opacity-0 group-hover:opacity-100"
                      >
                        · + note
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeItem(item.id, item.table)}
                  className="px-3 py-1.5 text-xs text-muted-light hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
