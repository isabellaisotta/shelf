import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { data: items, error } = await supabase
    .from("recommended")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: items || [] });
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
      source: source || "",
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

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Item id required" }, { status: 400 });

  await supabase.from("recommended").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
