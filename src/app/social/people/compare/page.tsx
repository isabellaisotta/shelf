"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import ItemGrid from "@/components/ItemGrid";
import MediaSearch from "@/components/MediaSearch";

interface Match {
  title: string;
  category: string;
  coverUrl: string;
  myRank: number;
  theirRank: number;
  closeness: number;
}

interface Item {
  id: string;
  category: string;
  title: string;
  creator: string;
  year: string;
  cover_url: string;
  rank: number;
}

interface MatchData {
  friend: { id: string; username: string; displayName: string };
  matches: Match[];
  onlyMine: Item[];
  onlyTheirs: Item[];
  stats: { totalMatches: number; myTotal: number; theirTotal: number };
}

interface Recommendation {
  vibe: string;
  common_ground: string[];
  differences: string[];
  from_their_list: { title: string; category: string; reason: string }[];
  new_picks: { title: string; creator: string; category: string; reason: string }[];
}

function CategoryLabel({ category }: { category: string }) {
  const label = category === "book" ? "Book" : category === "film" ? "Film" : "TV";
  return (
    <span className="text-[10px] uppercase tracking-wider text-muted-light font-medium">{label}</span>
  );
}

function CompareContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const friendId = searchParams.get("friendId");

  const [data, setData] = useState<MatchData | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recTimestamp, setRecTimestamp] = useState<string | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [activeTab, setActiveTab] = useState<"matches" | "shelf" | "recs">("matches");
  const [shelfCategory, setShelfCategory] = useState<"book" | "film" | "tv">("book");
  const [theirItems, setTheirItems] = useState<Item[]>([]);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  const loadMatch = useCallback(async () => {
    if (!friendId) return;
    const res = await fetch(`/api/match?friendId=${friendId}`);
    const matchData = await res.json();
    setData(matchData);

    const itemsRes = await fetch(`/api/items?userId=${friendId}`);
    const itemsData = await itemsRes.json();
    setTheirItems(itemsData.items || []);
  }, [friendId]);

  const loadSavedRec = useCallback(async () => {
    if (!friendId) return;
    try {
      const res = await fetch(`/api/recommend?friendId=${friendId}`);
      const recData = await res.json();
      if (recData.recommendation) {
        setRecommendation(recData.recommendation);
        setRecTimestamp(recData.created_at);
      }
    } catch {
      // silently fail
    }
  }, [friendId]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && friendId) {
      loadMatch();
      loadSavedRec();
    }
  }, [user, loading, router, friendId, loadMatch, loadSavedRec]);

  async function addToToConsume(title: string, category: string, creator: string, source?: string) {
    const key = `${category}:${title}`;
    if (addedItems.has(key)) return;
    try {
      const res = await fetch("/api/recommended", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title,
          creator,
          source: source || `AI pick from comparing with ${data?.friend.displayName || data?.friend.username || "friend"}`,
        }),
      });
      if (res.ok || res.status === 409) {
        setAddedItems((prev) => new Set(prev).add(key));
      }
    } catch {
      // silently fail
    }
  }

  const [addedShelfItems, setAddedShelfItems] = useState<Set<string>>(new Set());
  const [showSendRec, setShowSendRec] = useState(false);
  const [sendCategory, setSendCategory] = useState<"book" | "film" | "tv">("book");
  const [toast, setToast] = useState<string | null>(null);

  async function addFromShelf(item: { id: string; title: string; category: string; creator: string }) {
    const friendName = data?.friend.displayName || data?.friend.username || "friend";
    try {
      const res = await fetch("/api/recommended", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: item.category,
          title: item.title,
          creator: item.creator,
          source: `From ${friendName}'s trove`,
        }),
      });
      if (res.ok || res.status === 409) {
        setAddedShelfItems((prev) => new Set(prev).add(item.id));
      }
    } catch {
      // silently fail
    }
  }

  async function sendRecommendation(result: { title: string; creator: string; coverUrl: string }) {
    if (!friendId) return;
    const name = data?.friend.displayName || data?.friend.username || "friend";
    try {
      const res = await fetch("/api/recommended/friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: friendId,
          category: sendCategory,
          title: result.title,
          creator: result.creator,
          coverUrl: result.coverUrl,
        }),
      });
      if (res.ok) {
        setToast(`Sent "${result.title}" to ${name}`);
      } else if (res.status === 409) {
        setToast(`Already sent "${result.title}" to ${name}`);
      }
    } catch {
      setToast("Failed to send");
    }
    setShowSendRec(false);
    setTimeout(() => setToast(null), 3000);
  }

  async function generateRecommendation() {
    if (!friendId) return;
    setLoadingRec(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      });
      const recData = await res.json();
      setRecommendation(recData.recommendation);
      setRecTimestamp(recData.created_at);
    } catch {
      // silently fail
    }
    setLoadingRec(false);
  }

  if (loading || !user || !data) return null;

  const friend = data.friend;
  const friendName = friend.displayName || friend.username;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back link */}
      <a
        href="/social/people"
        className="inline-block text-sm text-muted hover:text-foreground mb-4 transition-colors"
      >
        &larr; Back to friends
      </a>

      {/* Header */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {friendName}
            </h1>
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-coral">{data.stats.totalMatches}</div>
                <div className="text-xs text-muted">matches</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-coral">{data.stats.theirTotal}</div>
                <div className="text-xs text-muted">their items</div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowSendRec(true)}
            className="px-4 py-2 bg-coral-muted text-coral rounded-lg text-sm font-medium hover:bg-coral hover:text-white transition-colors"
          >
            Send recommendation to {friendName}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("matches")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "matches" ? "bg-coral text-white" : "bg-surface text-muted border border-border hover:text-foreground"
          }`}
        >
          Matches
        </button>
        <button
          onClick={() => setActiveTab("shelf")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "shelf" ? "bg-coral text-white" : "bg-surface text-muted border border-border hover:text-foreground"
          }`}
        >
          {friendName}&apos;s Trove
        </button>
        <button
          onClick={() => setActiveTab("recs")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "recs" ? "bg-coral text-white" : "bg-surface text-muted border border-border hover:text-foreground"
          }`}
        >
          AI Recommendations
        </button>
      </div>

      {/* Matches view */}
      {activeTab === "matches" && (
        <>
          {data.matches.length > 0 ? (
            <div className="bg-surface rounded-xl border border-border p-6">
              <div className="space-y-3">
                {data.matches.map((m, i) => (
                  <div key={i} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
                    <div className="text-lg font-bold text-coral w-8">#{i + 1}</div>
                    {m.coverUrl ? (
                      <img src={m.coverUrl} alt="" className="w-10 h-14 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-14 bg-surface-hover rounded flex items-center justify-center">
                        <CategoryLabel category={m.category} />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{m.title}</div>
                      <div className="text-sm text-muted">
                        You: #{m.myRank} / {friendName}: #{m.theirRank}
                      </div>
                    </div>
                    {i === 0 && (
                      <span className="px-3 py-1 bg-coral-muted text-coral text-xs font-medium rounded-full">
                        Closest match
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted">
              <p>No matches yet. Add more items to find common ground.</p>
            </div>
          )}
        </>
      )}

      {/* Friend's trove view */}
      {activeTab === "shelf" && (
        <div>
          <div className="flex gap-2 mb-4">
            {([["book", "Books"], ["film", "Films"], ["tv", "TV Shows"]] as const).map(([key, label]) => {
              const count = theirItems.filter((i) => i.category === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setShelfCategory(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    shelfCategory === key
                      ? "bg-coral text-white"
                      : "bg-surface text-muted border border-border hover:text-foreground"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
          {theirItems.filter((i) => i.category === shelfCategory).length > 0 ? (
            <ItemGrid items={theirItems} category={shelfCategory} showComments viewingUserId={friendId!} onAdd={addFromShelf} addedItems={addedShelfItems} />
          ) : (
            <div className="text-center py-12 text-muted">
              <p>No {shelfCategory === "book" ? "books" : shelfCategory === "film" ? "films" : "TV shows"} yet.</p>
            </div>
          )}
        </div>
      )}

      {/* AI Recommendations view */}
      {activeTab === "recs" && (
        <div>
          {/* Generate / Refresh bar */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-muted-light">
              {recTimestamp
                ? `Last generated ${new Date(recTimestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                : "Powered by Claude. Based on the titles in your lists."
              }
            </p>
            <button
              onClick={generateRecommendation}
              disabled={loadingRec}
              className="px-4 py-2 bg-coral text-white rounded-lg text-sm font-medium hover:bg-coral-hover disabled:opacity-50 transition-colors"
            >
              {loadingRec ? "Analysing..." : recommendation ? "Refresh" : "Get recommendations"}
            </button>
          </div>

          {loadingRec && (
            <div className="bg-surface rounded-xl border border-border p-8 text-center">
              <div className="text-muted text-sm">Analysing your combined tastes...</div>
            </div>
          )}

          {!loadingRec && !recommendation && (
            <div className="text-center py-12 text-muted">
              <p>No recommendations yet. Hit the button to get AI-powered picks.</p>
            </div>
          )}

          {!loadingRec && recommendation && (
            <div className="space-y-4">
              {/* Vibe */}
              {recommendation.vibe && (
                <div className="bg-surface rounded-xl border border-coral/30 p-5">
                  <p className="text-foreground text-lg font-medium italic">&ldquo;{recommendation.vibe}&rdquo;</p>
                </div>
              )}

              {/* Common ground + Differences side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendation.common_ground.length > 0 && (
                  <div className="bg-surface rounded-xl border border-border p-5">
                    <h3 className="text-sm font-semibold text-coral uppercase tracking-wider mb-3">Common ground</h3>
                    <ul className="space-y-2">
                      {recommendation.common_ground.map((point, i) => (
                        <li key={i} className="text-sm text-foreground leading-relaxed">{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {recommendation.differences.length > 0 && (
                  <div className="bg-surface rounded-xl border border-border p-5">
                    <h3 className="text-sm font-semibold text-coral uppercase tracking-wider mb-3">Where you diverge</h3>
                    <ul className="space-y-2">
                      {recommendation.differences.map((point, i) => (
                        <li key={i} className="text-sm text-foreground leading-relaxed">{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* From their list */}
              {recommendation.from_their_list.length > 0 && (
                <div className="bg-surface rounded-xl border border-border p-5">
                  <h3 className="text-sm font-semibold text-coral uppercase tracking-wider mb-4">
                    Try from {friendName}&apos;s trove
                  </h3>
                  <div className="space-y-3">
                    {recommendation.from_their_list.map((pick, i) => {
                      const key = `${pick.category}:${pick.title}`;
                      const added = addedItems.has(key);
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-coral-muted text-coral text-xs font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{pick.title}</span>
                              <CategoryLabel category={pick.category} />
                            </div>
                            <p className="text-sm text-muted mt-0.5">{pick.reason}</p>
                          </div>
                          <button
                            onClick={() => addToToConsume(pick.title, pick.category, "")}
                            disabled={added}
                            className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                              added
                                ? "bg-surface-hover text-muted-light"
                                : "bg-coral-muted text-coral hover:bg-coral hover:text-white"
                            }`}
                          >
                            {added ? "In Up Next" : "+ Up Next"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* New picks */}
              {recommendation.new_picks.length > 0 && (
                <div className="bg-surface rounded-xl border border-border p-5">
                  <h3 className="text-sm font-semibold text-coral uppercase tracking-wider mb-4">
                    New for both of you
                  </h3>
                  <div className="space-y-3">
                    {recommendation.new_picks.map((pick, i) => {
                      const key = `${pick.category}:${pick.title}`;
                      const added = addedItems.has(key);
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-coral-muted text-coral text-xs font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{pick.title}</span>
                              {pick.creator && <span className="text-sm text-muted-light">by {pick.creator}</span>}
                              <CategoryLabel category={pick.category} />
                            </div>
                            <p className="text-sm text-muted mt-0.5">{pick.reason}</p>
                          </div>
                          <button
                            onClick={() => addToToConsume(pick.title, pick.category, pick.creator || "")}
                            disabled={added}
                            className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                              added
                                ? "bg-surface-hover text-muted-light"
                                : "bg-coral-muted text-coral hover:bg-coral hover:text-white"
                            }`}
                          >
                            {added ? "In Up Next" : "+ Up Next"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showSendRec && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 pt-24" onClick={() => setShowSendRec(false)}>
          <div className="bg-surface rounded-xl border border-border max-w-md w-full overflow-visible" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="font-semibold text-foreground mb-4">
                Send recommendation to {friendName}
              </h3>
              <div className="flex gap-2 mb-4">
                {([["book", "Books"], ["film", "Films"], ["tv", "TV Shows"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSendCategory(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      sendCategory === key
                        ? "bg-coral text-white"
                        : "bg-background text-muted border border-border hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative z-[60]">
                <MediaSearch key={sendCategory} category={sendCategory} onSelect={sendRecommendation} />
              </div>
              <p className="text-xs text-muted-light mt-2">
                Search and select to send to {friendName}
              </p>
              <button
                onClick={() => setShowSendRec(false)}
                className="mt-4 w-full py-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-coral/40 text-foreground text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted">Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}
