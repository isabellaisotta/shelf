import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // Get all the current user's items
  const { data: myItems } = await supabase
    .from("items")
    .select("id, title, category")
    .eq("user_id", user.id);

  if (!myItems || myItems.length === 0) {
    return NextResponse.json({ comments: [] });
  }

  const itemIds = myItems.map((i) => i.id);
  const itemMap = new Map(myItems.map((i) => [i.id, { id: i.id, title: i.title, category: i.category }]));

  // Get comments on those items by other users
  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, created_at, author_id, item_id")
    .in("item_id", itemIds)
    .neq("author_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!comments || comments.length === 0) {
    return NextResponse.json({ comments: [] });
  }

  // Get commenter profiles
  const authorIds = [...new Set(comments.map((c) => c.author_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", authorIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const enriched = comments.map((c) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    friend: {
      username: profileMap.get(c.author_id)?.username || "unknown",
      display_name: profileMap.get(c.author_id)?.display_name || "Unknown",
    },
    item: itemMap.get(c.item_id) || { id: c.item_id, title: "Unknown", category: "book" },
  }));

  return NextResponse.json({ comments: enriched });
}
