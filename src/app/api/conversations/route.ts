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

  // Merge and deduplicate messages
  const allMessages = [...(authoredMessages || []), ...(recipientMessages || [])];
  const uniqueMap = new Map(allMessages.map((m) => [m.id, m]));
  const messages = Array.from(uniqueMap.values());

  if (messages.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  // Get all recipients for all messages
  const messageIds = messages.map((m) => m.id);
  const { data: allRecipients } = await supabase
    .from("message_recipients")
    .select("message_id, recipient_id")
    .in("message_id", messageIds);

  // Build a map: message_id -> recipient_ids
  const msgRecipientMap = new Map<string, string[]>();
  for (const r of allRecipients || []) {
    const list = msgRecipientMap.get(r.message_id) || [];
    list.push(r.recipient_id);
    msgRecipientMap.set(r.message_id, list);
  }

  // For each message, determine the "other person" from my perspective
  // If I sent it: the other person is the recipient(s)
  // If I received it: the other person is the author
  // Group by item_id + other_person_id
  const conversationGroups = new Map<string, typeof messages>();

  for (const m of messages) {
    const recipients = msgRecipientMap.get(m.id) || [];

    if (m.author_id === user.id) {
      // I sent this - create a conversation per recipient
      for (const rid of recipients) {
        const key = `${m.item_id}:${rid}`;
        const group = conversationGroups.get(key) || [];
        group.push(m);
        conversationGroups.set(key, group);
      }
    } else {
      // I received this - the other person is the author
      const key = `${m.item_id}:${m.author_id}`;
      const group = conversationGroups.get(key) || [];
      group.push(m);
      conversationGroups.set(key, group);
    }
  }

  // Get item details
  const itemIds = [...new Set(messages.map((m) => m.item_id))];
  const { data: items } = await supabase
    .from("items")
    .select("id, title, category, cover_url")
    .in("id", itemIds);
  const itemMap = new Map((items || []).map((i) => [i.id, i]));

  // Get all relevant profiles
  const allPersonIds = new Set<string>();
  for (const m of messages) {
    allPersonIds.add(m.author_id);
  }
  for (const r of allRecipients || []) {
    allPersonIds.add(r.recipient_id);
  }
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", [...allPersonIds]);
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  // Build conversations
  const conversations = [...conversationGroups.entries()].map(([key, group]) => {
    const [itemId, otherPersonId] = key.split(":");
    const sorted = group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const lastMsg = sorted[0];
    const lastMsgAuthor = profileMap.get(lastMsg.author_id);
    const otherPerson = profileMap.get(otherPersonId);
    const item = itemMap.get(itemId);

    return {
      item: item || { id: itemId, title: "Unknown", category: "book", cover_url: "" },
      otherPerson: {
        id: otherPersonId,
        display_name: otherPerson?.display_name || otherPerson?.username || "Unknown",
      },
      lastMessage: {
        body: lastMsg.body,
        created_at: lastMsg.created_at,
        author: { display_name: lastMsgAuthor?.display_name || lastMsgAuthor?.username || "Unknown" },
      },
      messageCount: group.length,
    };
  });

  // Sort by most recent message
  conversations.sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());

  return NextResponse.json({ conversations });
}
