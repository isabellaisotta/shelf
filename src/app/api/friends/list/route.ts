import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // Get all accepted friendships where I'm involved
  const { data: friendships } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (!friendships || friendships.length === 0) {
    return NextResponse.json({ friends: [] });
  }

  // Get the other user's profile for each friendship
  const friendIds = friendships.map((f) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", friendIds);

  const friends = (profiles || []).map((p) => ({
    ...p,
    friendship_id: friendships.find(
      (f) => f.requester_id === p.id || f.addressee_id === p.id
    )?.id,
  }));

  return NextResponse.json({ friends });
}
