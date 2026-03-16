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
    return NextResponse.json({ activity: [] });
  }

  const friendIds = friendships.map((f) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );

  // Get recent items from friends
  const { data: items } = await supabase
    .from("items")
    .select("id, title, creator, category, cover_url, created_at, user_id")
    .in("user_id", friendIds)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!items || items.length === 0) {
    return NextResponse.json({ activity: [] });
  }

  // Get friend profiles
  const activeIds = [...new Set(items.map((i) => i.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", activeIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const activity = items.map((i) => ({
    title: i.title,
    creator: i.creator,
    category: i.category,
    cover_url: i.cover_url,
    created_at: i.created_at,
    friend: {
      id: i.user_id,
      username: profileMap.get(i.user_id)?.username || "unknown",
      display_name: profileMap.get(i.user_id)?.display_name || "Unknown",
    },
  }));

  return NextResponse.json({ activity });
}
