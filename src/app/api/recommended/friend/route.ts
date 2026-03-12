import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Send a recommendation to a friend
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { toUserId, category, title, creator, coverUrl } = await req.json();

  if (!toUserId || !category || !title) {
    return NextResponse.json({ error: "toUserId, category, and title required" }, { status: 400 });
  }

  const { data: item, error } = await supabase
    .from("friend_recommendations")
    .insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      category,
      title,
      creator: creator || "",
      cover_url: coverUrl || "",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already recommended" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, item });
}
