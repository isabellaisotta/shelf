import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { itemId } = await params;

  const { data: item, error } = await supabase
    .from("items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (error || !item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  // Get owner profile
  const { data: owner } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", item.user_id)
    .single();

  return NextResponse.json({
    item: {
      ...item,
      owner: { username: owner?.username || "unknown", display_name: owner?.display_name || "Unknown" },
    },
  });
}
