"use client";

import { useState } from "react";

interface Item {
  id: string;
  category: string;
  title: string;
  creator: string;
  year: string;
  cover_url: string;
  rank: number;
}

interface Comment {
  id: string;
  body: string;
  created_at: string;
  username: string;
  display_name: string;
}

interface Props {
  items: Item[];
  category: "book" | "film" | "tv";
  editable?: boolean;
  onDelete?: (id: string) => void;
  onReorder?: (items: { id: string; rank: number }[]) => void;
  showComments?: boolean;
  viewingUserId?: string;
}

export default function ItemGrid({ items, category, editable = false, onDelete, showComments = false }: Props) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  const categoryLabel = category === "book" ? "Books" : category === "film" ? "Films" : "TV Shows";
  const categoryEmoji = category === "book" ? "📚" : category === "film" ? "🎬" : "📺";

  const filtered = items.filter((i) => i.category === category).sort((a, b) => a.rank - b.rank);

  async function loadComments(item: Item) {
    setSelectedItem(item);
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/comments?itemId=${item.id}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }

  async function postComment() {
    if (!selectedItem || !newComment.trim()) return;
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: selectedItem.id, body: newComment.trim() }),
    });
    const data = await res.json();
    if (data.ok) {
      setComments([...comments, data.comment]);
      setNewComment("");
    }
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <span className="text-3xl">{categoryEmoji}</span>
        <p className="mt-2">No {categoryLabel.toLowerCase()} yet</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="group relative bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => showComments && loadComments(item)}
          >
            <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center z-10">
              {item.rank}
            </div>
            {editable && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                className="absolute top-2 right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                ×
              </button>
            )}
            {item.cover_url ? (
              <img
                src={item.cover_url}
                alt={item.title}
                className="w-full h-48 object-cover"
              />
            ) : (
              <div className="w-full h-48 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <span className="text-4xl">{categoryEmoji}</span>
              </div>
            )}
            <div className="p-3">
              <h3 className="font-medium text-sm text-gray-900 line-clamp-2">{item.title}</h3>
              {item.creator && (
                <p className="text-xs text-gray-500 mt-1">{item.creator}</p>
              )}
              {item.year && (
                <p className="text-xs text-gray-400">{item.year}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Comment modal */}
      {selectedItem && showComments && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedItem(null)}>
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                {selectedItem.cover_url ? (
                  <img src={selectedItem.cover_url} alt="" className="w-16 h-24 object-cover rounded" />
                ) : (
                  <div className="w-16 h-24 bg-indigo-100 rounded flex items-center justify-center text-2xl">
                    {categoryEmoji}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedItem.title}</h3>
                  {selectedItem.creator && <p className="text-sm text-gray-500">{selectedItem.creator}</p>}
                  <p className="text-sm text-indigo-600 font-medium">Ranked #{selectedItem.rank}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-700 mb-3">Comments</h4>
                {loadingComments ? (
                  <p className="text-gray-400 text-sm">Loading...</p>
                ) : comments.length === 0 ? (
                  <p className="text-gray-400 text-sm">No comments yet. Be the first!</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {comments.map((c) => (
                      <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            {c.display_name || c.username}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{c.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && postComment()}
                    placeholder="Write a comment..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    onClick={postComment}
                    disabled={!newComment.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Post
                  </button>
                </div>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
