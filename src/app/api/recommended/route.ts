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
  const { data: friendItems } = await supabase
    .from("friend_recommendations")
    .select("*, from_user:profiles!friend_recommendations_from_user_id_fkey(username, display_name)")
    .eq("to_user_id", user.id)
    .order("created_at", { ascending: false });

  // Merge into a single list with consistent shape
  const items = [
    ...(ownItems || []).map((i: Record<string, unknown>) => ({
      id: i.id,
      category: i.category,
      title: i.title,
      creator: i.creator,
      source: (i.source as string) || "Added by you",
      source_type: (i.source as string)?.startsWith("AI pick") ? "ai" : "self",
      created_at: i.created_at,
      table: "recommended" as const,
    })),
    ...(friendItems || []).map((i: Record<string, unknown>) => {
      const fromUser = i.from_user as { username: string; display_name: string } | null;
      const name = fromUser?.display_name || fromUser?.username || "A friend";
      return {
        id: i.id,
        category: i.category,
        title: i.title,
        creator: i.creator,
        source: `Recommended by ${name}`,
        source_type: "friend" as const,
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

  const { category, title, creator, source } = await req.json();

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
