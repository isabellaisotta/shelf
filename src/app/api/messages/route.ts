import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  // Fetch messages where I'm the author or a recipient, for this item
  const { data: myRecipientEntries } = await supabase
    .from("message_recipients")
    .select("message_id")
    .eq("recipient_id", user.id);

  const recipientMessageIds = (myRecipientEntries || []).map((r) => r.message_id);

  // Get messages on this item that I authored
  const { data: authoredMessages } = await supabase
    .from("messages")
    .select("id, body, created_at, author_id, item_id")
    .eq("item_id", itemId)
    .eq("author_id", user.id);

  // Get messages on this item where I'm a recipient
  let recipientMessages: typeof authoredMessages = [];
  if (recipientMessageIds.length > 0) {
    const { data } = await supabase
      .from("messages")
      .select("id, body, created_at, author_id, item_id")
      .eq("item_id", itemId)
      .in("id", recipientMessageIds);
    recipientMessages = data || [];
  }

  // Merge and deduplicate
  const allMessages = [...(authoredMessages || []), ...(recipientMessages || [])];
  const uniqueMap = new Map(allMessages.map((m) => [m.id, m]));
  const messages = Array.from(uniqueMap.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  if (messages.length === 0) {
    return NextResponse.json({ messages: [] });
  }

  // Get author profiles
  const authorIds = [...new Set(messages.map((m) => m.author_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", authorIds);
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  // Get recipients for each message
  const messageIds = messages.map((m) => m.id);
  const { data: allRecipients } = await supabase
    .from("message_recipients")
    .select("message_id, recipient_id")
    .in("message_id", messageIds);

  // Get recipient profiles
  const recipientIds = [...new Set((allRecipients || []).map((r) => r.recipient_id))];
  let recipientProfiles: Map<string, { id: string; username: string; display_name: string }> = new Map();
  if (recipientIds.length > 0) {
    const { data: rProfiles } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", recipientIds);
    recipientProfiles = new Map((rProfiles || []).map((p) => [p.id, p]));
  }

  const enriched = messages.map((m) => {
    const messageRecipients = (allRecipients || [])
      .filter((r) => r.message_id === m.id)
      .map((r) => {
        const p = recipientProfiles.get(r.recipient_id);
        return { id: r.recipient_id, username: p?.username || "unknown", display_name: p?.display_name || "Unknown" };
      });

    const author = profileMap.get(m.author_id);
    return {
      id: m.id,
      body: m.body,
      created_at: m.created_at,
      author: { id: m.author_id, username: author?.username || "unknown", display_name: author?.display_name || "Unknown" },
      recipients: messageRecipients,
    };
  });

  return NextResponse.json({ messages: enriched });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { itemId, body, recipientIds } = await req.json();
  if (!itemId || !body || !recipientIds?.length) {
    return NextResponse.json({ error: "itemId, body, and recipientIds required" }, { status: 400 });
  }

  // Insert the message
  const { data: message, error } = await supabase
    .from("messages")
    .insert({ item_id: itemId, author_id: user.id, body })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert recipients
  const recipientRows = recipientIds.map((rid: string) => ({
    message_id: message.id,
    recipient_id: rid,
  }));

  const { error: recipientError } = await supabase
    .from("message_recipients")
    .insert(recipientRows);

  if (recipientError) return NextResponse.json({ error: recipientError.message }, { status: 500 });

  // Get author profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .single();

  // Get recipient profiles
  const { data: rProfiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", recipientIds);

  return NextResponse.json({
    ok: true,
    message: {
      id: message.id,
      body: message.body,
      created_at: message.created_at,
      author: { id: user.id, username: profile?.username, display_name: profile?.display_name },
      recipients: (rProfiles || []).map((p) => ({ id: p.id, username: p.username, display_name: p.display_name })),
    },
  });
}
