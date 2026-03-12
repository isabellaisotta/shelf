import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, created_at, author_id")
    .eq("item_id", itemId)
    .order("created_at", { ascending: true });

  if (!comments || comments.length === 0) {
    return NextResponse.json({ comments: [] });
  }

  // Get author profiles
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
    username: profileMap.get(c.author_id)?.username || "unknown",
    display_name: profileMap.get(c.author_id)?.display_name || "Unknown",
  }));

  return NextResponse.json({ comments: enriched });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { itemId, body } = await req.json();
  if (!itemId || !body) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({ item_id: itemId, author_id: user.id, body })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    ok: true,
    comment: {
      id: comment.id,
      body: comment.body,
      created_at: comment.created_at,
      username: profile?.username,
      display_name: profile?.display_name,
    },
  });
}
