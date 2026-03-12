"use client";

import { useState, useRef } from "react";

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
  onAdd?: (item: Item) => void;
  addedItems?: Set<string>;
  onRecommend?: (item: Item) => void;
}

export default function ItemGrid({ items, category, editable = false, onDelete, onReorder, showComments = false, onAdd, addedItems, onRecommend }: Props) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const categoryLabel = category === "book" ? "Books" : category === "film" ? "Films" : "TV Shows";

  const filtered = items.filter((i) => i.category === category).sort((a, b) => a.rank - b.rank);

  function handleDragStart(index: number) {
    dragItem.current = index;
    setDragIndex(index);
  }

  function handleDragEnter(index: number) {
    dragOverItem.current = index;
  }

  function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      setDragIndex(null);
      return;
    }

    const reordered = [...filtered];
    const [dragged] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, dragged);

    const updates = reordered.map((item, i) => ({ id: item.id, rank: i + 1 }));

    if (onReorder) {
      onReorder(updates);
    }

    dragItem.current = null;
    dragOverItem.current = null;
    setDragIndex(null);
  }

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
      <div className="text-center py-8 text-muted">
        <p className="mt-2">No {categoryLabel.toLowerCase()} yet</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filtered.map((item, index) => (
          <div
            key={item.id}
            draggable={editable && !!onReorder}
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`group relative bg-surface rounded-xl border border-border overflow-hidden hover:border-coral/40 transition-all ${
              editable && onReorder ? "cursor-grab active:cursor-grabbing" : ""
            } ${dragIndex === index ? "opacity-40 scale-95" : ""} ${
              showComments ? "cursor-pointer" : ""
            }`}
            onClick={() => showComments && loadComments(item)}
          >
            <div className="absolute top-2 left-2 bg-coral text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center z-10">
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
                x
              </button>
            )}
            {onAdd && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!addedItems?.has(item.id)) onAdd(item);
                }}
                disabled={addedItems?.has(item.id)}
                className={`absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded-lg z-10 transition-all ${
                  addedItems?.has(item.id)
                    ? "bg-surface-hover text-muted-light opacity-100"
                    : "bg-coral-muted text-coral hover:bg-coral hover:text-white opacity-0 group-hover:opacity-100"
                }`}
              >
                {addedItems?.has(item.id) ? "Added to Recommended" : "+ Add to Recommended"}
              </button>
            )}
            {onRecommend && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRecommend(item);
                }}
                className="absolute bottom-14 right-2 text-xs font-medium px-2 py-1 rounded-lg z-10 transition-all bg-coral-muted text-coral hover:bg-coral hover:text-white opacity-0 group-hover:opacity-100"
                title="Send to a friend"
              >
                Send to friend
              </button>
            )}
            {item.cover_url ? (
              <img
                src={item.cover_url}
                alt={item.title}
                className="w-full h-48 object-cover"
                draggable={false}
              />
            ) : (
              <div className="w-full h-48 bg-surface-hover flex items-center justify-center">
                <span className="text-muted text-sm">{categoryLabel.slice(0, -1)}</span>
              </div>
            )}
            <div className="p-3">
              <h3 className="font-medium text-sm text-foreground line-clamp-2">{item.title}</h3>
              {item.creator && (
                <p className="text-xs text-muted mt-1">{item.creator}</p>
              )}
              {item.year && (
                <p className="text-xs text-muted-light">{item.year}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Comment modal */}
      {selectedItem && showComments && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedItem(null)}>
          <div className="bg-surface rounded-xl border border-border max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                {selectedItem.cover_url ? (
                  <img src={selectedItem.cover_url} alt="" className="w-16 h-24 object-cover rounded" />
                ) : (
                  <div className="w-16 h-24 bg-surface-hover rounded flex items-center justify-center text-sm text-muted">
                    {categoryLabel.slice(0, -1)}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-foreground">{selectedItem.title}</h3>
                  {selectedItem.creator && <p className="text-sm text-muted">{selectedItem.creator}</p>}
                  <p className="text-sm text-coral font-medium">Ranked #{selectedItem.rank}</p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-foreground mb-3">Comments</h4>
                {loadingComments ? (
                  <p className="text-muted text-sm">Loading...</p>
                ) : comments.length === 0 ? (
                  <p className="text-muted text-sm">No comments yet. Be the first!</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {comments.map((c) => (
                      <div key={c.id} className="bg-background rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {c.display_name || c.username}
                          </span>
                          <span className="text-xs text-muted-light">
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted">{c.body}</p>
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
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-light focus:ring-2 focus:ring-coral focus:border-transparent"
                  />
                  <button
                    onClick={postComment}
                    disabled={!newComment.trim()}
                    className="px-4 py-2 bg-coral text-white rounded-lg text-sm hover:bg-coral-hover disabled:opacity-50"
                  >
                    Post
                  </button>
                </div>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="mt-4 w-full py-2 text-sm text-muted hover:text-foreground"
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
