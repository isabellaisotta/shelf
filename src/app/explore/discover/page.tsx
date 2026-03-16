"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import MediaSearch from "@/components/MediaSearch";

interface Pick {
  title: string;
  creator: string;
  category: string;
  reason: string;
}

interface PersonalRec {
  taste_profile: string;
  picks: Pick[];
}

interface ActivityItem {
  title: string;
  creator: string;
  category: string;
  cover_url: string;
  external_id: string;
  year: string;
  created_at: string;
  friend: { id: string; username: string; display_name: string };
}

export default function DiscoverPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [searchCategory, setSearchCategory] = useState<"book" | "film" | "tv">("book");
  const [toast, setToast] = useState<string | null>(null);
  const [personalRec, setPersonalRec] = useState<PersonalRec | null>(null);
  const [recTimestamp, setRecTimestamp] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingRec, setLoadingRec] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [savingPick, setSavingPick] = useState<string | null>(null);
  const [savingActivity, setSavingActivity] = useState<string | null>(null);
  const [savedActivity, setSavedActivity] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    const [recRes, activityRes] = await Promise.all([
      fetch("/api/recommend/personal"),
      fetch("/api/friends/activity"),
    ]);
    const [recData, activityData] = await Promise.all([
      recRes.json(),
      activityRes.json(),
    ]);

    if (recData.recommendation) {
      setPersonalRec(recData.recommendation);
      setRecTimestamp(recData.created_at);
    }
    setActivity(activityData.activity || []);
    setLoadingRec(false);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) loadData();
  }, [user, loading, router, loadData]);

  async function handleSearchSelect(result: { title: string; creator: string; year: string; coverUrl: string; externalId: string }) {
    const res = await fetch("/api/recommended", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: searchCategory,
        title: result.title,
        creator: result.creator,
        source: "Added by you",
      }),
    });
    if (res.ok) {
      setToast(`Added "${result.title}" to To Consume`);
      setTimeout(() => setToast(null), 3000);
    } else {
      const data = await res.json();
      setToast(data.error || "Failed to add");
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function generateRecs() {
    setGenerating(true);
    try {
      const res = await fetch("/api/recommend/personal", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setToast(data.error);
        setTimeout(() => setToast(null), 3000);
      } else {
        setPersonalRec(data.recommendation);
        setRecTimestamp(data.created_at);
      }
    } catch {
      setToast("Failed to generate recommendations");
      setTimeout(() => setToast(null), 3000);
    }
    setGenerating(false);
  }

  async function savePick(pick: Pick) {
    const key = `${pick.title}|${pick.category}`;
    setSavingPick(key);
    const res = await fetch("/api/recommended", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: pick.category,
        title: pick.title,
        creator: pick.creator,
        source: "AI pick for you",
      }),
    });
    if (res.ok) {
      setToast(`Added "${pick.title}" to To Consume`);
    } else {
      const data = await res.json();
      setToast(data.error || "Failed to save");
    }
    setTimeout(() => setToast(null), 3000);
    setSavingPick(null);
  }

  async function saveActivityItem(item: ActivityItem) {
    const key = `${item.title}|${item.category}`;
    setSavingActivity(key);
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: item.category,
        title: item.title,
        creator: item.creator,
        year: item.year,
        coverUrl: item.cover_url,
        externalId: item.external_id,
      }),
    });
    if (res.ok) {
      setToast(`Added "${item.title}" to your shelf`);
      setSavedActivity((prev) => new Set(prev).add(key));
    } else {
      const data = await res.json();
      if (data.error?.includes("duplicate") || res.status === 409) {
        setToast("Already on your shelf");
        setSavedActivity((prev) => new Set(prev).add(key));
      } else {
        setToast(data.error || "Failed to add");
      }
    }
    setTimeout(() => setToast(null), 3000);
    setSavingActivity(null);
  }

  if (loading || !user) return null;

  const categoryTabs: { key: "book" | "film" | "tv"; label: string }[] = [
    { key: "book", label: "Book" },
    { key: "film", label: "Film" },
    { key: "tv", label: "TV" },
  ];

  function categoryBadge(category: string) {
    return category === "book" ? "BK" : category === "film" ? "FM" : "TV";
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-surface border border-border rounded-lg px-4 py-3 shadow-lg text-sm text-foreground">
          {toast}
        </div>
      )}

      {/* Search Section */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <h2 className="text-lg font-bold text-foreground mb-3">Search</h2>
        <div className="flex gap-2 mb-3">
          {categoryTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setSearchCategory(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                searchCategory === t.key
                  ? "bg-coral text-white"
                  : "bg-background text-muted border border-border hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <MediaSearch category={searchCategory} onSelect={handleSearchSelect} />
        <p className="text-xs text-muted-light mt-2">
          Search and select to add to To Consume
        </p>
      </div>

      {/* AI Picks for You */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">AI Picks for You</h2>
            {recTimestamp && (
              <p className="text-xs text-muted-light mt-0.5">
                Generated {timeAgo(recTimestamp)}
              </p>
            )}
          </div>
          <button
            onClick={generateRecs}
            disabled={generating}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              generating
                ? "bg-surface-hover text-muted cursor-not-allowed"
                : "bg-coral-muted text-coral hover:bg-coral hover:text-white"
            }`}
          >
            {generating ? "Generating..." : personalRec ? "Refresh" : "Generate"}
          </button>
        </div>

        {loadingRec ? (
          <div className="text-center py-8 text-muted text-sm">Loading...</div>
        ) : personalRec ? (
          <>
            <p className="text-sm text-muted italic mb-4">{personalRec.taste_profile}</p>
            <div className="space-y-2">
              {personalRec.picks.map((pick, i) => (
                <div
                  key={i}
                  className="group flex items-center gap-4 py-3 px-3 rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-coral-muted flex items-center justify-center">
                    <span className="text-coral text-xs font-bold uppercase">
                      {categoryBadge(pick.category)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">{pick.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {pick.creator && <span className="text-xs text-muted">{pick.creator}</span>}
                      {pick.creator && <span className="text-muted-light">·</span>}
                      <span className="text-xs text-muted-light capitalize">{pick.category}</span>
                    </div>
                    <p className="text-xs text-muted-light mt-0.5">{pick.reason}</p>
                  </div>
                  <button
                    onClick={() => savePick(pick)}
                    disabled={savingPick === `${pick.title}|${pick.category}`}
                    className="px-3 py-1.5 text-xs text-coral hover:bg-coral hover:text-white rounded-lg transition-colors border border-coral/30 opacity-0 group-hover:opacity-100"
                  >
                    + Save
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted">
            <p className="text-sm mb-1">No recommendations yet</p>
            <p className="text-xs text-muted-light">
              Hit Generate to get personalised picks based on your shelf
            </p>
          </div>
        )}
      </div>

      {/* Friends' Activity */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">
          Friends&apos; Activity
        </h2>
        {activity.length === 0 ? (
          <div className="bg-surface rounded-xl border border-border p-6 text-center">
            <p className="text-muted text-sm">No recent activity from friends.</p>
            <p className="text-muted-light text-xs mt-1">
              When friends add items to their shelves, you&apos;ll see it here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activity.map((item, i) => (
              <div
                key={i}
                className="group bg-surface rounded-xl border border-border p-4 hover:border-coral/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {item.cover_url ? (
                    <img
                      src={item.cover_url}
                      alt=""
                      className="w-10 h-14 object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-coral-muted flex items-center justify-center">
                      <span className="text-coral text-xs font-bold uppercase">
                        {categoryBadge(item.category)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm">
                        {item.friend.display_name || item.friend.username}
                      </span>
                      <span className="text-muted-light text-xs">added</span>
                    </div>
                    <div className="font-medium text-foreground mt-0.5">{item.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.creator && (
                        <span className="text-xs text-muted">{item.creator}</span>
                      )}
                      {item.creator && <span className="text-muted-light">·</span>}
                      <span className="text-xs text-muted-light capitalize">{item.category}</span>
                      <span className="text-muted-light">·</span>
                      <span className="text-xs text-muted-light">{timeAgo(item.created_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => saveActivityItem(item)}
                    disabled={savingActivity === `${item.title}|${item.category}` || savedActivity.has(`${item.title}|${item.category}`)}
                    className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-lg transition-colors border ${
                      savedActivity.has(`${item.title}|${item.category}`)
                        ? "bg-surface-hover text-muted-light border-border"
                        : "text-coral hover:bg-coral hover:text-white border-coral/30 opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {savedActivity.has(`${item.title}|${item.category}`) ? "Saved" : "+ Save"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
