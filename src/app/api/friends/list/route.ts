import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const db = getDb();

  const friends = db
    .prepare(`
      SELECT u.id, u.username, u.display_name, f.id as friendship_id
      FROM friendships f
      JOIN users u ON (
        CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END = u.id
      )
      WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
    `)
    .all(user.id, user.id, user.id);

  return NextResponse.json({ friends });
}
