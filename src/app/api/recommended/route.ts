import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // Get self-added and AI recommendations
  const { data: ownItems } = await supabase
    .from("recommended")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Get friend recommendations sent to me
  let friendItems: Record<string, unknown>[] = [];
  // Try with join first, fall back to plain query
  const { data: friendData, error: friendError } = await supabase
    .from("friend_recommendations")
    .select("*, from_user:profiles!friend_recommendations_from_user_id_fkey(username, display_name)")
    .eq("to_user_id", user.id)
    .order("created_at", { ascending: false });
  if (!friendError && friendData) {
    friendItems = friendData;
  } else {
    // Fallback: fetch without join, then look up sender names separately
    const { data: plainData } = await supabase
      .from("friend_recommendations")
      .select("*")
      .eq("to_user_id", user.id)
      .order("created_at", { ascending: false });
    if (plainData && plainData.length > 0) {
      const senderIds = [...new Set(plainData.map((r: Record<string, unknown>) => r.from_user_id as string))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", senderIds);
      const profileMap = new Map((profiles || []).map((p: { id: string; username: string; display_name: string }) => [p.id, p]));
      friendItems = plainData.map((r: Record<string, unknown>) => ({
        ...r,
        from_user: profileMap.get(r.from_user_id as string) || null,
      }));
    }
  }

  // Merge into a single list with consistent shape
  const items = [
    ...(ownItems || []).map((i: Record<string, unknown>) => ({
      id: i.id,
      category: i.category,
      title: i.title,
      creator: i.creator,
      source: (i.source as string) || "Added by you",
      source_type: (i.source as string)?.startsWith("AI pick") ? "ai" : (i.source as string)?.startsWith("From ") ? "from-shelf" : "self",
      notes: (i.notes as string) || "",
      created_at: i.created_at,
      table: "recommended" as const,
    })),
    ...friendItems.map((i: Record<string, unknown>) => {
      const fromUser = i.from_user as { username: string; display_name: string } | null;
      const name = fromUser?.display_name || fromUser?.username || "A friend";
      return {
        id: i.id,
        category: i.category,
        title: i.title,
        creator: i.creator,
        source: `Recommended by ${name}`,
        source_type: "friend" as const,
        notes: "",
        created_at: i.created_at,
        table: "friend_recommendations" as const,
      };
    }),
  ].sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { category, title, creator, source, notes } = await req.json();

  if (!category || !title) {
    return NextResponse.json({ error: "Category and title required" }, { status: 400 });
  }

  const { data: item, error } = await supabase
    .from("recommended")
    .insert({
      user_id: user.id,
      category,
      title,
      creator: creator || "",
      source: source || "Added by you",
      notes: notes || "",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already in your recommendations" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { id, notes, table } = await req.json();
  if (!id) return NextResponse.json({ error: "Item id required" }, { status: 400 });

  if (table === "friend_recommendations") {
    await supabase
      .from("friend_recommendations")
      .update({ notes: notes || "" })
      .eq("id", id)
      .eq("to_user_id", user.id);
  } else {
    await supabase
      .from("recommended")
      .update({ notes: notes || "" })
      .eq("id", id)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { id, table } = await req.json();
  if (!id) return NextResponse.json({ error: "Item id required" }, { status: 400 });

  if (table === "friend_recommendations") {
    await supabase.from("friend_recommendations").delete().eq("id", id).eq("to_user_id", user.id);
  } else {
    await supabase.from("recommended").delete().eq("id", id).eq("user_id", user.id);
  }
  return NextResponse.json({ ok: true });
}
