import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

interface ItemRow {
  id: string;
  category: string;
  title: string;
  creator: string;
  year: string;
  cover_url: string;
  rank: number;
}

interface Match {
  title: string;
  category: string;
  coverUrl: string;
  myRank: number;
  theirRank: number;
  closeness: number; // lower = closer match
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const friendId = req.nextUrl.searchParams.get("friendId");
  if (!friendId) return NextResponse.json({ error: "friendId required" }, { status: 400 });

  const db = getDb();

  // Verify friendship
  const friendship = db
    .prepare(
      "SELECT id FROM friendships WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)) AND status = 'accepted'"
    )
    .get(user.id, friendId, friendId, user.id);

  if (!friendship) return NextResponse.json({ error: "Not friends" }, { status: 403 });

  const myItems = db.prepare("SELECT * FROM items WHERE user_id = ? ORDER BY category, rank").all(user.id) as ItemRow[];
  const theirItems = db.prepare("SELECT * FROM items WHERE user_id = ? ORDER BY category, rank").all(friendId) as ItemRow[];

  const friend = db.prepare("SELECT username, display_name FROM users WHERE id = ?").get(friendId) as { username: string; display_name: string };

  // Find matches (same title, case-insensitive)
  const matches: Match[] = [];
  for (const myItem of myItems) {
    const theirItem = theirItems.find(
      (t) =>
        t.title.toLowerCase() === myItem.title.toLowerCase() &&
        t.category === myItem.category
    );
    if (theirItem) {
      matches.push({
        title: myItem.title,
        category: myItem.category,
        coverUrl: myItem.cover_url || theirItem.cover_url,
        myRank: myItem.rank,
        theirRank: theirItem.rank,
        closeness: myItem.rank + theirItem.rank, // Lower = both ranked it highly
      });
    }
  }

  // Sort by closeness (lowest combined rank = closest match)
  matches.sort((a, b) => a.closeness - b.closeness);

  // Items unique to each person (for recommendations)
  const myTitles = new Set(myItems.map((i) => `${i.category}:${i.title.toLowerCase()}`));
  const theirTitles = new Set(theirItems.map((i) => `${i.category}:${i.title.toLowerCase()}`));

  const onlyMine = myItems.filter((i) => !theirTitles.has(`${i.category}:${i.title.toLowerCase()}`));
  const onlyTheirs = theirItems.filter((i) => !myTitles.has(`${i.category}:${i.title.toLowerCase()}`));

  return NextResponse.json({
    friend: { id: friendId, username: friend.username, displayName: friend.display_name },
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
