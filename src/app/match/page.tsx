"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import ItemGrid from "@/components/ItemGrid";

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

function MatchContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const friendId = searchParams.get("friendId");

  const [data, setData] = useState<MatchData | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [activeTab, setActiveTab] = useState<"matches" | "shelf">("matches");
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

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && friendId) loadMatch();
  }, [user, loading, router, friendId, loadMatch]);

  async function addToRecommended(title: string, category: string, creator: string) {
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
          source: `AI pick from comparing with ${data?.friend.displayName || data?.friend.username || "friend"}`,
        }),
      });
      if (res.ok || res.status === 409) {
        setAddedItems((prev) => new Set(prev).add(key));
      }
    } catch {
      // silently fail
    }
  }

  async function getRecommendation() {
    if (!friendId) return;
    setLoadingRec(true);
    try {
      const res = await fetch(`/api/recommend?friendId=${friendId}`);
      const recData = await res.json();
      setRecommendation(recData.recommendation);
    } catch {
      // silently fail
    }
    setLoadingRec(false);
  }

  if (loading || !user || !data) return null;

  const friend = data.friend;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          You & {friend.displayName || friend.username}
        </h1>
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-coral">{data.stats.totalMatches}</div>
            <div className="text-xs text-muted">matches</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground">{data.stats.theirTotal}</div>
            <div className="text-xs text-muted">their items</div>
          </div>
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
          Matches ({data.stats.totalMatches})
        </button>
        <button
          onClick={() => setActiveTab("shelf")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "shelf" ? "bg-coral text-white" : "bg-surface text-muted border border-border hover:text-foreground"
          }`}
        >
          {friend.displayName || friend.username}&apos;s Shelf
        </button>
      </div>

      {/* Matches view */}
      {activeTab === "matches" && (
        <>
          {data.matches.length > 0 ? (
            <div className="bg-surface rounded-xl border border-border p-6 mb-6">
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
                        You: #{m.myRank} / {friend.displayName}: #{m.theirRank}
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

      {/* Friend's shelf view */}
      {activeTab === "shelf" && (
        <div className="mb-6">
          {(["book", "film", "tv"] as const).map((cat) => {
            const catItems = theirItems.filter((i) => i.category === cat);
            if (catItems.length === 0) return null;
            return (
              <div key={cat} className="mb-6">
                <h3 className="text-sm font-medium text-muted mb-3">
                  {cat === "book" ? "Books" : cat === "film" ? "Films" : "TV Shows"} ({catItems.length})
                </h3>
                <ItemGrid items={catItems} category={cat} showComments viewingUserId={friendId!} />
              </div>
            );
          })}
          {theirItems.length === 0 && (
            <div className="text-center py-12 text-muted">
              <p>{friend.displayName || friend.username} hasn&apos;t added anything yet.</p>
            </div>
          )}
        </div>
      )}

      {/* AI Recommendations */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">AI Recommendations</h2>
            <p className="text-xs text-muted-light mt-0.5">
              Powered by Claude. Based only on the titles in your lists.
            </p>
          </div>
          {!recommendation && (
            <button
              onClick={getRecommendation}
              disabled={loadingRec}
              className="px-5 py-2 bg-coral text-white rounded-lg text-sm font-medium hover:bg-coral-hover disabled:opacity-50 transition-colors"
            >
              {loadingRec ? "Analysing..." : "Get recommendations"}
            </button>
          )}
        </div>

        {loadingRec && (
          <div className="bg-surface rounded-xl border border-border p-8 text-center">
            <div className="text-muted text-sm">Analysing your combined tastes...</div>
          </div>
        )}

        {recommendation && (
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
                  Try from {friend.displayName}&apos;s shelf
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
                          onClick={() => addToRecommended(pick.title, pick.category, "")}
                          disabled={added}
                          className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            added
                              ? "bg-surface-hover text-muted-light"
                              : "bg-coral-muted text-coral hover:bg-coral hover:text-white"
                          }`}
                        >
                          {added ? "Added" : "+ Save"}
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
                          onClick={() => addToRecommended(pick.title, pick.category, pick.creator || "")}
                          disabled={added}
                          className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            added
                              ? "bg-surface-hover text-muted-light"
                              : "bg-coral-muted text-coral hover:bg-coral hover:text-white"
                          }`}
                        >
                          {added ? "Added" : "+ Save"}
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
    </div>
  );
}

export default function MatchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted">Loading...</div>}>
      <MatchContent />
    </Suspense>
  );
}
