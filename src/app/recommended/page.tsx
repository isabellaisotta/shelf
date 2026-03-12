"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface RecommendedItem {
  id: string;
  category: string;
  title: string;
  creator: string;
  source: string;
  created_at: string;
}

type Category = "all" | "book" | "film" | "tv";

export default function RecommendedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<RecommendedItem[]>([]);
  const [activeTab, setActiveTab] = useState<Category>("all");

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/recommended");
    const data = await res.json();
    setItems(data.items || []);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) loadItems();
  }, [user, loading, router, loadItems]);

  async function removeItem(id: string) {
    await fetch("/api/recommended", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
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

  const filtered = activeTab === "all" ? items : items.filter((i) => i.category === activeTab);

  const counts = {
    all: items.length,
    book: items.filter((i) => i.category === "book").length,
    film: items.filter((i) => i.category === "film").length,
    tv: items.filter((i) => i.category === "tv").length,
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Recommended</h1>
            <p className="text-sm text-muted mt-1">AI picks from your taste comparisons</p>
          </div>
          <div className="flex gap-6 text-center">
            {tabs.slice(1).map((t) => (
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
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <p className="text-lg mb-2">No recommendations yet</p>
          <p className="text-sm text-muted-light">
            Compare tastes with a friend and save AI recommendations here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group bg-surface rounded-xl border border-border p-4 flex items-center gap-4 hover:border-coral/30 transition-colors"
            >
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
                  {item.source && (
                    <>
                      {item.creator && <span className="text-muted-light">·</span>}
                      <span className="text-xs text-muted-light">{item.source}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeItem(item.id)}
                className="px-3 py-1.5 text-xs text-muted-light hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
