import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // Get friend IDs
  const { data: friendships } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (!friendships || friendships.length === 0) {
    return NextResponse.json({ nudges: [] });
  }

  const friendIds = friendships.map((f) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );

  // Get my items and friend items in parallel
  const [myResult, friendResult, profileResult] = await Promise.all([
    supabase.from("items").select("title, category, creator, cover_url").eq("user_id", user.id),
    supabase.from("items").select("title, category, creator, cover_url, user_id").in("user_id", friendIds),
    supabase.from("profiles").select("id, username, display_name").in("id", friendIds),
  ]);

  const myItems = myResult.data || [];
  const friendItems = friendResult.data || [];
  const profiles = profileResult.data || [];
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // Build a set of my items by key (title+category)
  const myItemKeys = new Set(myItems.map((i) => `${i.title.toLowerCase()}|${i.category}`));

  // Find overlapping items (same title+category as mine) per friend
  // Then find what else those friends have that I don't
  const friendOverlap = new Map<string, Set<string>>(); // friendId -> set of shared item keys

  for (const item of friendItems) {
    const key = `${item.title.toLowerCase()}|${item.category}`;
    if (myItemKeys.has(key)) {
      if (!friendOverlap.has(item.user_id)) {
        friendOverlap.set(item.user_id, new Set());
      }
      friendOverlap.get(item.user_id)!.add(key);
    }
  }

  // Only consider friends who share at least 1 item with me
  const relevantFriendIds = [...friendOverlap.keys()].filter(
    (fid) => (friendOverlap.get(fid)?.size || 0) >= 1
  );

  if (relevantFriendIds.length === 0) {
    return NextResponse.json({ nudges: [] });
  }

  // For each friend item I DON'T have, count how many relevant friends have it
  const nudgeCandidates = new Map<string, {
    title: string;
    creator: string;
    category: string;
    cover_url: string;
    friends: string[];
    sharedCount: number;
  }>();

  for (const item of friendItems) {
    if (!relevantFriendIds.includes(item.user_id)) continue;
    const key = `${item.title.toLowerCase()}|${item.category}`;
    if (myItemKeys.has(key)) continue; // I already have this

    if (!nudgeCandidates.has(key)) {
      nudgeCandidates.set(key, {
        title: item.title,
        creator: item.creator,
        category: item.category,
        cover_url: item.cover_url,
        friends: [],
        sharedCount: 0,
      });
    }
    const candidate = nudgeCandidates.get(key)!;
    if (!candidate.friends.includes(item.user_id)) {
      candidate.friends.push(item.user_id);
      candidate.sharedCount++;
    }
  }

  // Sort by frequency and take top 10
  const sorted = [...nudgeCandidates.values()]
    .sort((a, b) => b.sharedCount - a.sharedCount)
    .slice(0, 10);

  const nudges = sorted.map((n) => {
    const friendNames = n.friends.map((fid) => {
      const p = profileMap.get(fid);
      return { username: p?.username || "unknown", display_name: p?.display_name || "Unknown" };
    });
    const count = n.friends.length;
    const sharedTitle = myItems[0]?.title || "your favorites";
    const reason = count === 1
      ? `${friendNames[0].display_name}, who shares your taste, also has this`
      : `${count} friends who share your taste also have this`;

    return {
      title: n.title,
      creator: n.creator,
      category: n.category,
      cover_url: n.cover_url,
      reason,
      friends: friendNames,
    };
  });

  return NextResponse.json({ nudges });
}
