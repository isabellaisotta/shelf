import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const db = getDb();

  const incoming = db
    .prepare(`
      SELECT f.id as friendship_id, u.username, u.display_name
      FROM friendships f
      JOIN users u ON f.requester_id = u.id
      WHERE f.addressee_id = ? AND f.status = 'pending'
    `)
    .all(user.id);

  const outgoing = db
    .prepare(`
      SELECT f.id as friendship_id, u.username, u.display_name
      FROM friendships f
      JOIN users u ON f.addressee_id = u.id
      WHERE f.requester_id = ? AND f.status = 'pending'
    `)
    .all(user.id);

  return NextResponse.json({ incoming, outgoing });
}
