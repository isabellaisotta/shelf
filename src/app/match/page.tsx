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

function MatchContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const friendId = searchParams.get("friendId");

  const [data, setData] = useState<MatchData | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [activeTab, setActiveTab] = useState<"matches" | "theirs" | "mine">("matches");
  const [theirItems, setTheirItems] = useState<Item[]>([]);

  const loadMatch = useCallback(async () => {
    if (!friendId) return;
    const res = await fetch(`/api/match?friendId=${friendId}`);
    const matchData = await res.json();
    setData(matchData);

    // Load their full items for comments
    const itemsRes = await fetch(`/api/items?userId=${friendId}`);
    const itemsData = await itemsRes.json();
    setTheirItems(itemsData.items || []);
  }, [friendId]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && friendId) loadMatch();
  }, [user, loading, router, friendId, loadMatch]);

  async function getRecommendation() {
    if (!friendId) return;
    setLoadingRec(true);
    const res = await fetch(`/api/recommend?friendId=${friendId}`);
    const recData = await res.json();
    setRecommendation(recData.recommendation);
    setLoadingRec(false);
  }

  if (loading || !user || !data) return null;

  const friend = data.friend;
  const categoryEmoji = (cat: string) => cat === "book" ? "📚" : cat === "film" ? "🎬" : "📺";

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          You & {friend.displayName || friend.username}
        </h1>
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-indigo-600">{data.stats.totalMatches}</div>
            <div className="text-xs text-gray-500">matches</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-400">{data.stats.myTotal}</div>
            <div className="text-xs text-gray-500">your items</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-400">{data.stats.theirTotal}</div>
            <div className="text-xs text-gray-500">their items</div>
          </div>
        </div>
      </div>

      {/* Matches */}
      {data.matches.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Your matches</h2>
          <div className="space-y-3">
            {data.matches.map((m, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
                <div className="text-lg font-bold text-indigo-600 w-8">#{i + 1}</div>
                {m.coverUrl ? (
                  <img src={m.coverUrl} alt="" className="w-10 h-14 object-cover rounded" />
                ) : (
                  <div className="w-10 h-14 bg-indigo-100 rounded flex items-center justify-center">
                    {categoryEmoji(m.category)}
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{m.title}</div>
                  <div className="text-sm text-gray-500">
                    {categoryEmoji(m.category)} You: #{m.myRank} · {friend.displayName}: #{m.theirRank}
                  </div>
                </div>
                {i === 0 && (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                    Closest match!
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs for unique items */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("theirs")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === "theirs" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 border border-gray-200"
          }`}
        >
          {friend.displayName}&apos;s unique picks
        </button>
        <button
          onClick={() => setActiveTab("mine")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === "mine" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 border border-gray-200"
          }`}
        >
          Your unique picks
        </button>
      </div>

      {activeTab === "theirs" && (
        <div className="mb-6">
          {(["book", "film", "tv"] as const).map((cat) => {
            const catItems = theirItems.filter((i) => i.category === cat);
            if (catItems.length === 0) return null;
            return (
              <div key={cat} className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 mb-3">
                  {categoryEmoji(cat)} {cat === "book" ? "Books" : cat === "film" ? "Films" : "TV Shows"}
                </h3>
                <ItemGrid items={catItems} category={cat} showComments viewingUserId={friendId!} />
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "mine" && (
        <div className="mb-6">
          <p className="text-sm text-gray-400 mb-4">
            These are in your list but not in {friend.displayName}&apos;s.
          </p>
          {data.onlyMine.map((item) => (
            <div key={item.id} className="inline-flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 mr-2 mb-2 text-sm">
              {categoryEmoji(item.category)} {item.title}
            </div>
          ))}
        </div>
      )}

      {/* AI Recommendations */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">AI Recommendations</h2>
            <p className="text-xs text-gray-500 mt-1">
              Powered by Claude. Based only on the titles in your lists.
            </p>
          </div>
          {!recommendation && (
            <button
              onClick={getRecommendation}
              disabled={loadingRec}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loadingRec ? "Thinking..." : "Get recommendations"}
            </button>
          )}
        </div>

        {loadingRec && (
          <div className="text-gray-500 text-sm">Analyzing your tastes...</div>
        )}

        {recommendation && (
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
            {recommendation}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MatchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>}>
      <MatchContent />
    </Suspense>
  );
}
