"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface Author {
  id: string;
  username: string;
  display_name: string;
}

interface Recipient {
  id: string;
  username: string;
  display_name: string;
}

interface Message {
  id: string;
  body: string;
  created_at: string;
  author: Author;
  recipients: Recipient[];
}

interface ItemDetail {
  id: string;
  title: string;
  creator: string;
  year: string;
  category: string;
  cover_url: string;
  rank: number;
  owner: { username: string; display_name: string };
}

interface Friend {
  id: string;
  username: string;
  display_name: string;
}

export default function ThreadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const itemId = params.itemId as string;

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [sending, setSending] = useState(false);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    const [itemRes, messagesRes, friendsRes] = await Promise.all([
      fetch(`/api/items/${itemId}`),
      fetch(`/api/messages?itemId=${itemId}`),
      fetch("/api/friends/list"),
    ]);

    const [itemData, messagesData, friendsData] = await Promise.all([
      itemRes.json(),
      messagesRes.json(),
      friendsRes.json(),
    ]);

    setItem(itemData.item || null);
    setMessages(messagesData.messages || []);
    setFriends(friendsData.friends || []);

    // Default recipients to the last message's recipients if any
    const msgs = messagesData.messages || [];
    if (msgs.length > 0) {
      const lastMsg = msgs[msgs.length - 1];
      const lastRecipientIds = lastMsg.recipients.map((r: Recipient) => r.id);
      // If I was a recipient, add the author instead
      const defaultIds = new Set<string>();
      for (const rid of lastRecipientIds) {
        if (rid !== itemData.item?.owner?.id) defaultIds.add(rid);
      }
      if (lastMsg.author.id !== messagesData.currentUserId) {
        defaultIds.add(lastMsg.author.id);
      }
      setSelectedRecipients(Array.from(defaultIds));
    }

    setLoadingData(false);
  }, [itemId]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) loadData();
  }, [user, loading, router, loadData]);

  function toggleRecipient(id: string) {
    setSelectedRecipients((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  async function sendMessage() {
    if (!newMessage.trim() || selectedRecipients.length === 0) return;
    setSending(true);

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, body: newMessage.trim(), recipientIds: selectedRecipients }),
    });
    const data = await res.json();

    if (data.ok) {
      setMessages((prev) => [...prev, data.message]);
      setNewMessage("");
    }
    setSending(false);
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

  const categoryLabel = item?.category === "book" ? "Book" : item?.category === "film" ? "Film" : "TV Show";

  if (loading || !user) return null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="text-sm text-muted hover:text-foreground mb-6 flex items-center gap-1"
      >
        <span>&larr;</span> Back
      </button>

      {loadingData ? (
        <div className="text-center py-16 text-muted">Loading...</div>
      ) : !item ? (
        <div className="text-center py-16 text-muted">Item not found</div>
      ) : (
        <>
          {/* Item header card */}
          <div className="bg-surface rounded-xl border border-border p-5 mb-6">
            <div className="flex items-start gap-4">
              {item.cover_url ? (
                <img src={item.cover_url} alt="" className="w-16 h-24 object-cover rounded flex-shrink-0" />
              ) : (
                <div className="w-16 h-24 bg-surface-hover rounded flex items-center justify-center text-sm text-muted flex-shrink-0">
                  {categoryLabel}
                </div>
              )}
              <div>
                <h1 className="font-semibold text-lg text-foreground">{item.title}</h1>
                {item.creator && <p className="text-sm text-muted">{item.creator}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-coral-muted text-coral font-medium">
                    {categoryLabel}
                  </span>
                  <span className="text-xs text-muted-light">
                    {item.owner.display_name || item.owner.username}&apos;s shelf
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Messages thread */}
          <div className="space-y-3 mb-6">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted text-sm">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.author.id === user.id;
                return (
                  <div key={m.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-coral-muted flex items-center justify-center">
                      <span className="text-coral text-xs font-bold">
                        {(m.author.display_name || m.author.username)[0].toUpperCase()}
                      </span>
                    </div>
                    <div className={`max-w-[75%] ${isMe ? "text-right" : ""}`}>
                      <div className={`rounded-xl px-4 py-2.5 ${isMe ? "bg-coral text-white" : "bg-surface border border-border text-foreground"}`}>
                        <p className="text-sm">{m.body}</p>
                      </div>
                      <div className={`flex items-center gap-2 mt-1 text-xs text-muted-light ${isMe ? "justify-end" : ""}`}>
                        <span>{m.author.display_name || m.author.username}</span>
                        <span>&middot;</span>
                        <span>{timeAgo(m.created_at)}</span>
                        {m.recipients.length > 0 && (
                          <>
                            <span>&middot;</span>
                            <span>to {m.recipients.map((r) => r.display_name || r.username).join(", ")}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Compose */}
          <div className="bg-surface rounded-xl border border-border p-4">
            {/* Recipient pills */}
            <div className="flex flex-wrap gap-2 mb-3">
              {friends.map((f) => (
                <button
                  key={f.id}
                  onClick={() => toggleRecipient(f.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    selectedRecipients.includes(f.id)
                      ? "bg-coral text-white border-coral"
                      : "bg-surface-hover text-muted border-border hover:border-coral/40"
                  }`}
                >
                  {f.display_name || f.username}
                </button>
              ))}
              {friends.length === 0 && (
                <p className="text-xs text-muted-light">Add friends to start messaging</p>
              )}
            </div>

            {/* Message input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Write a message..."
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-light focus:ring-2 focus:ring-coral focus:border-transparent"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || selectedRecipients.length === 0 || sending}
                className="px-4 py-2 bg-coral text-white rounded-lg text-sm hover:bg-coral-hover disabled:opacity-50"
              >
                Send
              </button>
            </div>
            {selectedRecipients.length === 0 && newMessage.trim() && (
              <p className="text-xs text-coral mt-2">Select at least one friend to send to</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
