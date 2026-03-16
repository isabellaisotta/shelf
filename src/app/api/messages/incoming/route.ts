import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // Get message IDs where I'm a recipient
  const { data: recipientEntries } = await supabase
    .from("message_recipients")
    .select("message_id")
    .eq("recipient_id", user.id);

  if (!recipientEntries || recipientEntries.length === 0) {
    return NextResponse.json({ messages: [] });
  }

  const messageIds = recipientEntries.map((r) => r.message_id);

  // Get those messages (not authored by me)
  const { data: messages } = await supabase
    .from("messages")
    .select("id, body, created_at, author_id, item_id")
    .in("id", messageIds)
    .neq("author_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!messages || messages.length === 0) {
    return NextResponse.json({ messages: [] });
  }

  // Get author profiles
  const authorIds = [...new Set(messages.map((m) => m.author_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", authorIds);
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  // Get item details
  const itemIds = [...new Set(messages.map((m) => m.item_id))];
  const { data: items } = await supabase
    .from("items")
    .select("id, title, category, cover_url")
    .in("id", itemIds);
  const itemMap = new Map((items || []).map((i) => [i.id, i]));

  const enriched = messages.map((m) => {
    const author = profileMap.get(m.author_id);
    const item = itemMap.get(m.item_id);
    return {
      id: m.id,
      body: m.body,
      created_at: m.created_at,
      author: { username: author?.username || "unknown", display_name: author?.display_name || "Unknown" },
      item: item || { id: m.item_id, title: "Unknown", category: "book", cover_url: "" },
    };
  });

  return NextResponse.json({ messages: enriched });
}
