import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // Incoming requests
  const { data: incomingRaw } = await supabase
    .from("friendships")
    .select("id, requester_id")
    .eq("addressee_id", user.id)
    .eq("status", "pending");

  let incoming: { friendship_id: string; username: string; display_name: string }[] = [];
  if (incomingRaw && incomingRaw.length > 0) {
    const requesterIds = incomingRaw.map((r) => r.requester_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", requesterIds);

    incoming = (profiles || []).map((p) => ({
      friendship_id: incomingRaw.find((r) => r.requester_id === p.id)!.id,
      username: p.username,
      display_name: p.display_name,
    }));
  }

  // Outgoing requests
  const { data: outgoingRaw } = await supabase
    .from("friendships")
    .select("id, addressee_id")
    .eq("requester_id", user.id)
    .eq("status", "pending");

  let outgoing: { friendship_id: string; username: string; display_name: string }[] = [];
  if (outgoingRaw && outgoingRaw.length > 0) {
    const addresseeIds = outgoingRaw.map((r) => r.addressee_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", addresseeIds);

    outgoing = (profiles || []).map((p) => ({
      friendship_id: outgoingRaw.find((r) => r.addressee_id === p.id)!.id,
      username: p.username,
      display_name: p.display_name,
    }));
  }

  return NextResponse.json({ incoming, outgoing });
}
