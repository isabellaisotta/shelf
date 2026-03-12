"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Friend {
  id: string;
  username: string;
  display_name: string;
  friendship_id: string;
}

interface FriendRequest {
  friendship_id: string;
  username: string;
  display_name: string;
}

export default function FriendsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");

  const loadFriends = useCallback(async () => {
    const [friendsRes, requestsRes] = await Promise.all([
      fetch("/api/friends/list"),
      fetch("/api/friends/requests"),
    ]);
    const friendsData = await friendsRes.json();
    const requestsData = await requestsRes.json();
    setFriends(friendsData.friends || []);
    setIncoming(requestsData.incoming || []);
    setOutgoing(requestsData.outgoing || []);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) loadFriends();
  }, [user, loading, router, loadFriends]);

  async function sendRequest() {
    setMessage("");
    const res = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("Request sent!");
      setUsername("");
      await loadFriends();
    } else {
      setMessage(data.error);
    }
  }

  async function respondToRequest(friendshipId: string, action: "accept" | "reject") {
    await fetch("/api/friends/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendshipId, action }),
    });
    await loadFriends();
  }

  if (loading || !user) return null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Friends</h1>

      {/* Add friend */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="font-medium text-gray-700 mb-3">Add a friend</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendRequest()}
            placeholder="Enter their username"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={sendRequest}
            disabled={!username.trim()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
        {message && (
          <p className={`text-sm mt-2 ${message.includes("sent") ? "text-green-600" : "text-red-500"}`}>
            {message}
          </p>
        )}
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-medium text-gray-700 mb-3">Friend requests</h2>
          <div className="space-y-3">
            {incoming.map((req) => (
              <div key={req.friendship_id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium text-gray-900">{req.display_name}</span>
                  <span className="text-gray-500 text-sm ml-2">@{req.username}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respondToRequest(req.friendship_id, "accept")}
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respondToRequest(req.friendship_id, "reject")}
                    className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-medium text-gray-700 mb-3">Pending requests</h2>
          <div className="space-y-2">
            {outgoing.map((req) => (
              <div key={req.friendship_id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium text-gray-900">{req.display_name}</span>
                  <span className="text-gray-500 text-sm ml-2">@{req.username}</span>
                </div>
                <span className="text-sm text-gray-400">Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-medium text-gray-700 mb-3">Your friends</h2>
        {friends.length === 0 ? (
          <p className="text-gray-400 text-sm">No friends yet. Add someone above!</p>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => (
              <Link
                key={friend.id}
                href={`/match?friendId=${friend.id}`}
                className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                <div>
                  <span className="font-medium text-gray-900">{friend.display_name}</span>
                  <span className="text-gray-500 text-sm ml-2">@{friend.username}</span>
                </div>
                <span className="text-indigo-600 text-sm font-medium">Compare tastes →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
