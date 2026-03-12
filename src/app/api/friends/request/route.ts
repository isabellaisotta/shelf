import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { username } = await req.json();
  if (!username) return NextResponse.json({ error: "Username required" }, { status: 400 });

  const db = getDb();

  const target = db.prepare("SELECT id FROM users WHERE username = ?").get(username.toLowerCase()) as { id: string } | undefined;
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.id === user.id) return NextResponse.json({ error: "Can't friend yourself" }, { status: 400 });

  // Check existing friendship in either direction
  const existing = db
    .prepare(
      "SELECT id FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)"
    )
    .get(user.id, target.id, target.id, user.id);

  if (existing) return NextResponse.json({ error: "Friend request already exists" }, { status: 409 });

  db.prepare("INSERT INTO friendships (id, requester_id, addressee_id) VALUES (?, ?, ?)").run(
    uuid(),
    user.id,
    target.id
  );

  return NextResponse.json({ ok: true });
}
