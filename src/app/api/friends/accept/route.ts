import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { friendshipId, action } = await req.json();
  if (!friendshipId || !action) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const db = getDb();

  const friendship = db
    .prepare("SELECT * FROM friendships WHERE id = ? AND addressee_id = ? AND status = 'pending'")
    .get(friendshipId, user.id) as { id: string } | undefined;

  if (!friendship) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  if (action === "accept") {
    db.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?").run(friendshipId);
  } else {
    db.prepare("UPDATE friendships SET status = 'rejected' WHERE id = ?").run(friendshipId);
  }

  return NextResponse.json({ ok: true });
}
