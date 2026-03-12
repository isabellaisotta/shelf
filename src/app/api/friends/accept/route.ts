import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { friendshipId, action } = await req.json();
  if (!friendshipId || !action) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const newStatus = action === "accept" ? "accepted" : "rejected";

  const { error } = await supabase
    .from("friendships")
    .update({ status: newStatus })
    .eq("id", friendshipId)
    .eq("addressee_id", user.id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
