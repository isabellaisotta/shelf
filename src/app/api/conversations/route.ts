import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // Get messages I authored
  const { data: authoredMessages } = await supabase
    .from("messages")
    .select("id, item_id, body, created_at, author_id")
    .eq("author_id", user.id);

  // Get message IDs where I'm a recipient
  const { data: recipientEntries } = await supabase
    .from("message_recipients")
    .select("message_id")
    .eq("recipient_id", user.id);

  const recipientMessageIds = (recipientEntries || []).map((r) => r.message_id);

  let recipientMessages: typeof authoredMessages = [];
  if (recipientMessageIds.length > 0) {
    const { data } = await supabase
      .from("messages")
      .select("id, item_id, body, created_at, author_id")
      .in("id", recipientMessageIds);
    recipientMessages = data || [];
  }

  // Merge and deduplicate
  const allMessages = [...(authoredMessages || []), ...(recipientMessages || [])];
  const uniqueMap = new Map(allMessages.map((m) => [m.id, m]));
  const messages = Array.from(uniqueMap.values());

  if (messages.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  // Group by item_id
  const itemGroups = new Map<string, typeof messages>();
  for (const m of messages) {
    const group = itemGroups.get(m.item_id) || [];
    group.push(m);
    itemGroups.set(m.item_id, group);
  }

  // Get item details
  const itemIds = [...itemGroups.keys()];
  const { data: items } = await supabase
    .from("items")
    .select("id, title, category, cover_url")
    .in("id", itemIds);
  const itemMap = new Map((items || []).map((i) => [i.id, i]));

  // Get author profiles for last messages
  const authorIds = [...new Set(messages.map((m) => m.author_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", authorIds);
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  // Build conversations
  const conversations = itemIds.map((itemId) => {
    const group = itemGroups.get(itemId)!;
    const sorted = group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const lastMsg = sorted[0];
    const author = profileMap.get(lastMsg.author_id);
    const item = itemMap.get(itemId);

    return {
      item: item || { id: itemId, title: "Unknown", category: "book", cover_url: "" },
      lastMessage: {
        body: lastMsg.body,
        created_at: lastMsg.created_at,
        author: { display_name: author?.display_name || author?.username || "Unknown" },
      },
      messageCount: group.length,
    };
  });

  // Sort by most recent message
  conversations.sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());

  return NextResponse.json({ conversations });
}
