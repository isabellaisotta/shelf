import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

interface Match {
  title: string;
  category: string;
  coverUrl: string;
  myRank: number;
  theirRank: number;
  closeness: number;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const friendId = req.nextUrl.searchParams.get("friendId");
  if (!friendId) return NextResponse.json({ error: "friendId required" }, { status: 400 });

  // Verify friendship
  const { data: friendship } = await supabase
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`)
    .single();

  if (!friendship) return NextResponse.json({ error: "Not friends" }, { status: 403 });

  const [myResult, theirResult, friendProfile] = await Promise.all([
    supabase.from("items").select("*").eq("user_id", user.id).order("rank"),
    supabase.from("items").select("*").eq("user_id", friendId).order("rank"),
    supabase.from("profiles").select("username, display_name").eq("id", friendId).single(),
  ]);

  const myItems = myResult.data || [];
  const theirItems = theirResult.data || [];
  const friend = friendProfile.data;

  // Find matches
  const matches: Match[] = [];
  for (const myItem of myItems) {
    const theirItem = theirItems.find(
      (t) => t.title.toLowerCase() === myItem.title.toLowerCase() && t.category === myItem.category
    );
    if (theirItem) {
      matches.push({
        title: myItem.title,
        category: myItem.category,
        coverUrl: myItem.cover_url || theirItem.cover_url,
        myRank: myItem.rank,
        theirRank: theirItem.rank,
        closeness: myItem.rank + theirItem.rank,
      });
    }
  }

  matches.sort((a, b) => a.closeness - b.closeness);

  const myTitles = new Set(myItems.map((i) => `${i.category}:${i.title.toLowerCase()}`));
  const theirTitles = new Set(theirItems.map((i) => `${i.category}:${i.title.toLowerCase()}`));

  const onlyMine = myItems.filter((i) => !theirTitles.has(`${i.category}:${i.title.toLowerCase()}`));
  const onlyTheirs = theirItems.filter((i) => !myTitles.has(`${i.category}:${i.title.toLowerCase()}`));

  return NextResponse.json({
    friend: { id: friendId, username: friend?.username, displayName: friend?.display_name },
    matches,
    onlyMine: onlyMine.slice(0, 20),
    onlyTheirs: onlyTheirs.slice(0, 20),
    stats: {
      totalMatches: matches.length,
      myTotal: myItems.length,
      theirTotal: theirItems.length,
    },
  });
}
